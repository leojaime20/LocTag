import { collection, doc, getDocs, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export const LEGACY_PROJECT_ID = 'p84';
export const MASTER_EMAIL = 'leojaime20@gmail.com';

export interface Project {
  id: string;
  name: string;
}

export function projectCollection(projectId: string, name: string) {
  return projectId === LEGACY_PROJECT_ID
    ? collection(db, name)
    : collection(db, 'projects', projectId, name);
}

export function projectDoc(projectId: string, name: string, id: string) {
  return projectId === LEGACY_PROJECT_ID
    ? doc(db, name, id)
    : doc(db, 'projects', projectId, name, id);
}

export function projectPdfPath(projectId: string, filename: string) {
  return projectId === LEGACY_PROJECT_ID
    ? `pdfs/${filename}`
    : `projects/${projectId}/pdfs/${filename}`;
}

export async function getProjects(): Promise<Project[]> {
  const snapshot = await getDocs(collection(db, 'projects'));
  return [
    { id: LEGACY_PROJECT_ID, name: 'P84' },
    ...snapshot.docs
      .filter((item) => item.id !== LEGACY_PROJECT_ID)
      .map((item) => ({ id: item.id, name: String(item.data().name || item.id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ];
}

export async function createProject(id: string, name: string) {
  const normalized = id.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(normalized) || normalized === LEGACY_PROJECT_ID)
    throw new Error('Use um ID de 2 a 40 caracteres, com letras, números ou hífen.');
  if (!name.trim()) throw new Error('Informe o nome do projeto.');
  const reference = doc(db, 'projects', normalized);
  await runTransaction(db, async (transaction) => {
    if ((await transaction.get(reference)).exists())
      throw new Error('Este ID de projeto já existe.');
    transaction.set(reference, { name: name.trim(), createdAt: serverTimestamp() });
  });
}
