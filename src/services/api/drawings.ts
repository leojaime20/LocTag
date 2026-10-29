import { doc, getDoc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { LEGACY_PROJECT_ID, projectCollection, projectDoc, projectPdfPath } from './projects';
import { normalizeRegion, type RawRegionDocument } from '../../types/firebase';
import type { Drawing, GlobalDrawings, ViewKind, VolumeRegion } from '../../types/domain';
import { fitAffine } from '../../utils/calibration';
import { hasValidBounds } from '../../utils/regions';

export const globalsRef = (projectId = LEGACY_PROJECT_ID) =>
  projectDoc(projectId, 'settings', 'globalDrawings');
export async function getGlobalDrawings(
  projectId = LEGACY_PROJECT_ID,
): Promise<GlobalDrawings | null> {
  const snap = await getDoc(globalsRef(projectId));
  return snap.exists() ? (snap.data() as GlobalDrawings) : null;
}
export async function getRegions(projectId = LEGACY_PROJECT_ID) {
  const snap = await getDocs(projectCollection(projectId, 'regions'));
  return snap.docs.map((d) => normalizeRegion(d.id, d.data() as RawRegionDocument));
}
export function validateDrawing(drawing: Drawing, projectId = LEGACY_PROJECT_ID) {
  const prefix = projectPdfPath(projectId, '');
  if (!drawing.path.startsWith(prefix) || !drawing.path.endsWith('.pdf'))
    throw new Error(`Informe um PDF do Firebase Storage em ${prefix}.`);
  if (
    !Number.isInteger(drawing.pageIndex) ||
    drawing.pageIndex < 0 ||
    !drawing.page ||
    !Number.isFinite(drawing.page.width) ||
    !Number.isFinite(drawing.page.height) ||
    drawing.page.width <= 0 ||
    drawing.page.height <= 0
  )
    throw new Error('Abra a página do PDF antes de salvar.');
  if (drawing.calibration.model !== 'affine' || drawing.calibration.pdfId !== drawing.path)
    throw new Error('Calibração não corresponde ao PDF.');
  if (!Number.isFinite(drawing.calibration.tolerance) || drawing.calibration.tolerance! <= 0)
    throw new Error('Informe uma tolerância positiva em pontos PDF.');
  fitAffine(drawing.calibration.points);
  if (
    drawing.calibration.points.some(
      (p) =>
        p.pdfX < 0 || p.pdfY < 0 || p.pdfX > drawing.page!.width || p.pdfY > drawing.page!.height,
    )
  )
    throw new Error('Há pontos de calibração fora da página.');
}
export async function saveGlobalDrawings(config: GlobalDrawings, projectId = LEGACY_PROJECT_ID) {
  validateDrawing(config.plant, projectId);
  validateDrawing(config.side, projectId);
  if (
    config.units !== 'm' ||
    ![config.initialZoom, config.shareZoom].every((v) => Number.isFinite(v) && v >= 1 && v <= 32)
  )
    throw new Error('Zoom deve estar entre 1 e 32.');
  if (config.exampleRegionId) {
    const exampleRegion = await getDoc(projectDoc(projectId, 'regions', config.exampleRegionId));
    if (
      !exampleRegion.exists() ||
      exampleRegion.data().archived ||
      !hasValidBounds(exampleRegion.data())
    )
      throw new Error('A região do exemplo precisa existir e ter limites válidos.');
  }
  // Keep a reversible history, including calibration, before switching versions.
  const revisionRef = doc(projectCollection(projectId, 'drawingRevisions'));
  await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(globalsRef(projectId));
    if (previous.exists())
      transaction.set(revisionRef, { ...previous.data(), archivedAt: serverTimestamp() });
    transaction.set(globalsRef(projectId), { ...config, updatedAt: serverTimestamp() });
  });
}
export async function uploadGlobalPdf(
  view: ViewKind,
  file: File,
  onProgress: (percent: number) => void,
  projectId = LEGACY_PROJECT_ID,
) {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecione um arquivo PDF.');
  const signature = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer());
  if (!signature.includes('%PDF-'))
    throw new Error('O arquivo não possui um cabeçalho PDF válido.');
  const path = projectPdfPath(projectId, `global-${view}-${crypto.randomUUID()}.pdf`);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file, { contentType: 'application/pdf' });
    task.on(
      'state_changed',
      (s) => onProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
      reject,
      () => resolve(),
    );
  });
  return path;
}
export async function saveVolumeRegion(
  region: VolumeRegion,
  creating: boolean,
  projectId = LEGACY_PROJECT_ID,
) {
  if (
    !region.id.trim() ||
    region.id.includes('/') ||
    region.id === '.' ||
    region.id === '..' ||
    /^__.*__$/.test(region.id) ||
    new TextEncoder().encode(region.id).length > 1500 ||
    !region.name.trim() ||
    !hasValidBounds(region)
  )
    throw new Error('Preencha nome, um ID válido para o Firestore (sem barras) e limites válidos.');
  const reference = projectDoc(projectId, 'regions', region.id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (creating && existing.exists())
      throw new Error('Este ID já existe, inclusive entre regiões arquivadas.');
    if (!creating && !existing.exists())
      throw new Error('A região foi removida. Recarregue a lista.');
    transaction.set(
      reference,
      { ...region, archived: false, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
}
export async function archiveRegion(id: string, projectId = LEGACY_PROJECT_ID) {
  const reference = projectDoc(projectId, 'regions', id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (!existing.exists()) throw new Error('Região não encontrada.');
    transaction.update(reference, { archived: true, updatedAt: serverTimestamp() });
  });
}
export async function deleteRegion(id: string, projectId = LEGACY_PROJECT_ID) {
  const reference = projectDoc(projectId, 'regions', id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    const globals = await transaction.get(globalsRef(projectId));
    if (!existing.exists()) throw new Error('Região não encontrada.');
    if (globals.exists() && globals.data().exampleRegionId === id)
      throw new Error(
        'Esta região está configurada como região ilustrativa. Altere a região em Desenhos globais antes de excluí-la.',
      );
    // TAGs retain their legacy regionId; PDFs may be shared with other drawings.
    transaction.delete(reference);
  });
}
