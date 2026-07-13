import { getDownloadURL, ref } from 'firebase/storage';

import { storage } from './config';

export async function resolveStorageUrl(path: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return getDownloadURL(ref(storage, path));
}
