import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type { Calibration, EquipmentTag, Region, ViewKind } from '../../types/domain';
import {
  normalizeRegion,
  normalizeTag,
  type RawRegionDocument,
  type RawTagDocument,
} from '../../types/firebase';
import { auth, db, storage } from '../firebase/config';
import {
  MASTER_EMAIL,
  LEGACY_PROJECT_ID,
  projectCollection,
  projectDoc,
  projectPdfPath,
} from './projects';

export interface AdminProfile {
  email: string;
  role: 'master' | 'admin' | 'user';
  projectIds: string[];
}

export interface RegionInput {
  id: string;
  name: string;
  plantPdf: string;
  sidePdf: string;
  plantCalibration: Calibration;
  sideCalibration: Calibration;
}

export async function getCurrentAdminProfile(): Promise<AdminProfile | null> {
  const email = auth.currentUser?.email;
  if (!email) return null;

  const snapshot = await getDoc(doc(db, 'authorizedUsers', email));
  if (!snapshot.exists() && email !== MASTER_EMAIL) return null;
  const data = (snapshot.data() ?? {}) as Partial<AdminProfile>;
  return {
    email,
    role: email === MASTER_EMAIL ? 'master' : data.role === 'admin' ? 'admin' : 'user',
    projectIds:
      email === MASTER_EMAIL
        ? []
        : Array.isArray(data.projectIds)
          ? data.projectIds
          : data.role === 'admin'
            ? [LEGACY_PROJECT_ID]
            : [],
  };
}

export async function getEditableRegion(
  regionId: string,
  projectId = LEGACY_PROJECT_ID,
): Promise<Region | null> {
  const snapshot = await getDoc(projectDoc(projectId, 'regions', regionId));
  if (!snapshot.exists()) return null;
  return normalizeRegion(snapshot.id, snapshot.data() as RawRegionDocument);
}

export async function uploadRegionPdf(
  regionId: string,
  view: ViewKind,
  file: File,
  projectId = LEGACY_PROJECT_ID,
): Promise<string> {
  const suffix = view === 'plant' ? 'planta' : 'lateral';
  const path = projectPdfPath(projectId, `${regionId}-${suffix}.pdf`);
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: 'application/pdf' });
  await getDownloadURL(fileRef);
  return path;
}

export async function saveRegion(input: RegionInput, projectId = LEGACY_PROJECT_ID): Promise<void> {
  await setDoc(
    projectDoc(projectId, 'regions', input.id),
    {
      name: input.name,
      plantPdf: input.plantPdf,
      sidePdf: input.sidePdf,
      plantCalibration: input.plantCalibration,
      sideCalibration: input.sideCalibration,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function tagDocumentId(tag: EquipmentTag) {
  return tag.id || encodeURIComponent(tag.tag.trim());
}

async function commitInChunks(operations: ((batch: ReturnType<typeof writeBatch>) => void)[]) {
  const chunkSize = 450;

  let committed = 0;
  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(index, index + chunkSize).forEach((operation) => operation(batch));
    try {
      await batch.commit();
      committed += Math.min(chunkSize, operations.length - index);
    } catch {
      throw new Error(
        `Importação interrompida: ${committed} operações desta etapa foram confirmadas. Pode haver dados parcialmente atualizados. Confira a tabela, mantenha o CSV original e repita a importação completa.`,
      );
    }
  }
}

export async function getAllTags(projectId = LEGACY_PROJECT_ID): Promise<EquipmentTag[]> {
  const snapshot = await getDocs(query(projectCollection(projectId, 'tags'), orderBy('tag')));
  return snapshot.docs.map((item) => normalizeTag(item.id, item.data() as RawTagDocument));
}

export async function replaceAllTags(
  tags: EquipmentTag[],
  projectId = LEGACY_PROJECT_ID,
): Promise<void> {
  const existing = await getDocs(projectCollection(projectId, 'tags'));
  const incomingIds = new Set(tags.map(tagDocumentId));
  const upsertOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
  const deleteOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];

  tags.forEach((tag) => {
    upsertOperations.push((batch) => {
      batch.set(
        projectDoc(projectId, 'tags', tagDocumentId(tag)),
        {
          tag: tag.tag,
          description: tag.description,
          regionId: tag.regionId,
          ...(tag.moduleRegion !== undefined ? { moduleRegion: tag.moduleRegion } : {}),
          ...(tag.owner !== undefined ? { owner: tag.owner } : {}),
          ...(tag.elevation !== undefined ? { elevation: tag.elevation } : {}),
          x: tag.x,
          y: tag.y,
          z: tag.z,
          type: tag.type,
          status: tag.status,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    });
  });

  existing.docs.forEach((item) => {
    if (!incomingIds.has(item.id)) {
      deleteOperations.push((batch) => batch.delete(item.ref));
    }
  });

  // Small replacements are atomic; large imports explicitly report partial failures.
  if (upsertOperations.length + deleteOperations.length <= 450) {
    await commitInChunks([...upsertOperations, ...deleteOperations]);
  } else {
    await commitInChunks(upsertOperations);
    try {
      await commitInChunks(deleteOperations);
    } catch (error) {
      throw new Error(
        `TAGs do CSV gravadas, mas a remoção das ausentes foi interrompida. ${error instanceof Error ? error.message : ''}`,
        { cause: error },
      );
    }
  }
}

export async function getAdminUsers(): Promise<AdminProfile[]> {
  const snap = await getDocs(collection(db, 'authorizedUsers'));
  return snap.docs.map((item) => ({
    email: item.id,
    role: item.id === MASTER_EMAIL ? 'master' : item.data().role === 'admin' ? 'admin' : 'user',
    projectIds: Array.isArray(item.data().projectIds)
      ? item.data().projectIds
      : item.data().role === 'admin'
        ? [LEGACY_PROJECT_ID]
        : [],
  }));
}

export async function saveAdminUser(email: string, projectIds: string[]): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized === MASTER_EMAIL)
    throw new Error('Informe um e-mail válido de outro usuário.');
  await setDoc(
    doc(db, 'authorizedUsers', normalized),
    { role: 'admin', projectIds: [...new Set(projectIds)] },
    { merge: true },
  );
}
