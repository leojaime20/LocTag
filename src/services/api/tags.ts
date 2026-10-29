import { endAt, getDoc, getDocs, limit, orderBy, query, startAt, where } from 'firebase/firestore';

import { LEGACY_PROJECT_ID, projectCollection, projectDoc } from './projects';
import type { EquipmentTag, Region } from '../../types/domain';
import {
  fallbackRegion,
  normalizeRegion,
  normalizeTag,
  type RawRegionDocument,
  type RawTagDocument,
} from '../../types/firebase';

const TAG_LIMIT = 25;

const uniqueById = (tags: EquipmentTag[]) => {
  const seen = new Set<string>();
  return tags.filter((tag) => {
    if (seen.has(tag.id)) return false;
    seen.add(tag.id);
    return true;
  });
};

async function searchByField(
  field: 'tag' | 'description' | 'descricao',
  term: string,
  projectId: string,
) {
  const snapshot = await getDocs(
    query(
      projectCollection(projectId, 'tags'),
      orderBy(field),
      startAt(term),
      endAt(`${term}\uf8ff`),
      limit(TAG_LIMIT),
    ),
  );

  return snapshot.docs.map((item) => normalizeTag(item.id, item.data() as RawTagDocument));
}

export async function searchTags(
  term: string,
  projectId = LEGACY_PROJECT_ID,
): Promise<EquipmentTag[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  const variants = [trimmed, trimmed.toUpperCase()];
  const results = await Promise.allSettled([
    ...variants.map((value) => searchByField('tag', value, projectId)),
    searchByField('description', trimmed, projectId),
    searchByField('descricao', trimmed, projectId),
  ]);

  return uniqueById(
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : [])),
  );
}

export async function getTagByTag(
  tag: string,
  projectId = LEGACY_PROJECT_ID,
): Promise<EquipmentTag | null> {
  const snapshot = await getDocs(
    query(projectCollection(projectId, 'tags'), where('tag', '==', tag), limit(1)),
  );
  const first = snapshot.docs[0];
  return first ? normalizeTag(first.id, first.data() as RawTagDocument) : null;
}

export async function getRegion(regionId: string, projectId = LEGACY_PROJECT_ID): Promise<Region> {
  if (!regionId) return fallbackRegion;
  const snapshot = await getDoc(projectDoc(projectId, 'regions', regionId));
  if (!snapshot.exists()) return { ...fallbackRegion, id: regionId, name: regionId };
  return normalizeRegion(snapshot.id, snapshot.data() as RawRegionDocument);
}
