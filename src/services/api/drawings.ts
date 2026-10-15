import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { db, storage } from '../firebase/config';
import { normalizeRegion, type RawRegionDocument } from '../../types/firebase';
import type { Drawing, GlobalDrawings, ViewKind, VolumeRegion } from '../../types/domain';
import { fitAffine } from '../../utils/calibration';
import { hasValidBounds } from '../../utils/regions';

export const globalsRef = doc(db, 'settings', 'globalDrawings');
export async function getGlobalDrawings(): Promise<GlobalDrawings | null> {
  const snap = await getDoc(globalsRef);
  return snap.exists() ? (snap.data() as GlobalDrawings) : null;
}
export async function getRegions() {
  const snap = await getDocs(collection(db, 'regions'));
  return snap.docs.map((d) => normalizeRegion(d.id, d.data() as RawRegionDocument));
}
export function validateDrawing(drawing: Drawing) {
  if (!drawing.path.startsWith('pdfs/') || !drawing.path.endsWith('.pdf'))
    throw new Error('Informe um PDF do Firebase Storage em pdfs/.');
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
export async function saveGlobalDrawings(config: GlobalDrawings) {
  validateDrawing(config.plant);
  validateDrawing(config.side);
  if (
    config.units !== 'm' ||
    ![config.initialZoom, config.shareZoom].every((v) => Number.isFinite(v) && v >= 1 && v <= 32)
  )
    throw new Error('Zoom deve estar entre 1 e 32.');
  if (config.exampleRegionId) {
    const exampleRegion = await getDoc(doc(db, 'regions', config.exampleRegionId));
    if (
      !exampleRegion.exists() ||
      exampleRegion.data().archived ||
      !hasValidBounds(exampleRegion.data())
    )
      throw new Error('A região do exemplo precisa existir e ter limites válidos.');
  }
  // Keep a reversible history, including calibration, before switching versions.
  const revisionRef = doc(collection(db, 'drawingRevisions'));
  await runTransaction(db, async (transaction) => {
    const previous = await transaction.get(globalsRef);
    if (previous.exists())
      transaction.set(revisionRef, { ...previous.data(), archivedAt: serverTimestamp() });
    transaction.set(globalsRef, { ...config, updatedAt: serverTimestamp() });
  });
}
export async function uploadGlobalPdf(
  view: ViewKind,
  file: File,
  onProgress: (percent: number) => void,
) {
  if (!file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecione um arquivo PDF.');
  const signature = new TextDecoder().decode(await file.slice(0, 1024).arrayBuffer());
  if (!signature.includes('%PDF-'))
    throw new Error('O arquivo não possui um cabeçalho PDF válido.');
  const path = `pdfs/global-${view}-${crypto.randomUUID()}.pdf`;
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
export async function saveVolumeRegion(region: VolumeRegion, creating: boolean) {
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
  const reference = doc(db, 'regions', region.id);
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
export async function archiveRegion(id: string) {
  const reference = doc(db, 'regions', id);
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(reference);
    if (!existing.exists()) throw new Error('Região não encontrada.');
    transaction.update(reference, { archived: true, updatedAt: serverTimestamp() });
  });
}
