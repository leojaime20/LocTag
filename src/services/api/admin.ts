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

export interface AdminProfile {
  email: string;
  role: 'admin' | 'user';
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
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Partial<AdminProfile>;
  return {
    email,
    role: data.role === 'admin' ? 'admin' : 'user',
  };
}

export async function getEditableRegion(regionId: string): Promise<Region | null> {
  const snapshot = await getDoc(doc(db, 'regions', regionId));
  if (!snapshot.exists()) return null;
  return normalizeRegion(snapshot.id, snapshot.data() as RawRegionDocument);
}

export async function uploadRegionPdf(
  regionId: string,
  view: ViewKind,
  file: File,
): Promise<string> {
  const suffix = view === 'plant' ? 'planta' : 'lateral';
  const path = `pdfs/${regionId}-${suffix}.pdf`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, file, { contentType: 'application/pdf' });
  await getDownloadURL(fileRef);
  return path;
}

export async function saveRegion(input: RegionInput): Promise<void> {
  await setDoc(
    doc(db, 'regions', input.id),
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
  return encodeURIComponent((tag.id || tag.tag).trim());
}

async function commitInChunks(operations: ((batch: ReturnType<typeof writeBatch>) => void)[]) {
  const chunkSize = 450;

  for (let index = 0; index < operations.length; index += chunkSize) {
    const batch = writeBatch(db);
    operations.slice(index, index + chunkSize).forEach((operation) => operation(batch));
    await batch.commit();
  }
}

export async function getAllTags(): Promise<EquipmentTag[]> {
  const snapshot = await getDocs(query(collection(db, 'tags'), orderBy('tag')));
  return snapshot.docs.map((item) => normalizeTag(item.id, item.data() as RawTagDocument));
}

export async function replaceAllTags(tags: EquipmentTag[]): Promise<void> {
  const existing = await getDocs(collection(db, 'tags'));
  const incomingIds = new Set(tags.map(tagDocumentId));
  const upsertOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];
  const deleteOperations: ((batch: ReturnType<typeof writeBatch>) => void)[] = [];

  tags.forEach((tag) => {
    upsertOperations.push((batch) => {
      batch.set(doc(db, 'tags', tagDocumentId(tag)), {
        tag: tag.tag,
        description: tag.description,
        regionId: tag.regionId,
        x: tag.x,
        y: tag.y,
        z: tag.z,
        type: tag.type,
        status: tag.status,
        updatedAt: serverTimestamp(),
      });
    });
  });

  existing.docs.forEach((item) => {
    if (!incomingIds.has(item.id)) {
      deleteOperations.push((batch) => batch.delete(item.ref));
    }
  });

  await commitInChunks(upsertOperations);
  await commitInChunks(deleteOperations);
}
