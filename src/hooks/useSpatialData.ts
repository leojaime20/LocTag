import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { onSnapshot } from 'firebase/firestore';
import { LEGACY_PROJECT_ID, projectCollection } from '../services/api/projects';
import { getGlobalDrawings, getRegions, globalsRef } from '../services/api/drawings';
import { normalizeRegion, type RawRegionDocument } from '../types/firebase';
import type { GlobalDrawings } from '../types/domain';

export function useSpatialData(enabled = true, projectId = LEGACY_PROJECT_ID) {
  const client = useQueryClient();
  const regions = useQuery({
    queryKey: ['regions', projectId],
    queryFn: () => getRegions(projectId),
    enabled,
    staleTime: Infinity,
  });
  const drawings = useQuery({
    queryKey: ['global-drawings', projectId],
    queryFn: () => getGlobalDrawings(projectId),
    enabled,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!enabled) return;
    const stopRegions = onSnapshot(
      projectCollection(projectId, 'regions'),
      (snap) =>
        client.setQueryData(
          ['regions', projectId],
          snap.docs.map((d) => normalizeRegion(d.id, d.data() as RawRegionDocument)),
        ),
      () => {
        void client.invalidateQueries({ queryKey: ['regions', projectId] });
      },
    );
    const stopDrawings = onSnapshot(
      globalsRef(projectId),
      (snap) =>
        client.setQueryData(
          ['global-drawings', projectId],
          snap.exists() ? (snap.data() as GlobalDrawings) : null,
        ),
      () => {
        void client.invalidateQueries({ queryKey: ['global-drawings', projectId] });
      },
    );
    return () => {
      stopRegions();
      stopDrawings();
    };
  }, [client, enabled, projectId]);
  return { regions, drawings };
}
