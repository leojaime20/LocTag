// In-memory transaction boundary for the region UI tests; never connects to Firebase.
export * from 'firebase/firestore';
import type { DocumentReference, DocumentData } from 'firebase/firestore';

export const documents = new Map<string, DocumentData>([
  ['regions/a', { name: 'Deck A', archived: false }],
  ['tags/pump', { regionId: 'a' }],
]);
export const writes: string[] = [];
export let failure = '';
export function failWith(message: string) {
  failure = message;
}
export async function runTransaction(
  _db: unknown,
  execute: (transaction: {
    get: (reference: DocumentReference) => Promise<{
      exists: () => boolean;
      data: () => DocumentData | undefined;
    }>;
    delete: (reference: DocumentReference) => void;
    update: (reference: DocumentReference, data: DocumentData) => void;
  }) => Promise<void>,
) {
  if (failure) throw new Error(failure);
  const pending: (() => void)[] = [];
  await execute({
    get: async (reference) => ({
      exists: () => documents.has(reference.path),
      data: () => documents.get(reference.path),
    }),
    delete: (reference) => {
      pending.push(() => {
        writes.push(`delete:${reference.path}`);
        documents.delete(reference.path);
      });
    },
    update: (reference, data) => {
      pending.push(() => {
        writes.push(`update:${reference.path}`);
        documents.set(reference.path, { ...documents.get(reference.path), ...data });
      });
    },
  });
  pending.forEach((commit) => commit());
}
