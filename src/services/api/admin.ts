import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type { Calibration, Region, ViewKind } from '../../types/domain';
import { normalizeRegion, type RawRegionDocument } from '../../types/firebase';
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

export async function uploadRegionPdf(regionId: string, view: ViewKind, file: File): Promise<string> {
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
