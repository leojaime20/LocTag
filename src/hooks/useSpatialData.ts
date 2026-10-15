import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { getGlobalDrawings, getRegions, globalsRef } from '../services/api/drawings';
import { normalizeRegion, type RawRegionDocument } from '../types/firebase';
import type { GlobalDrawings } from '../types/domain';

export function useSpatialData(enabled = true) {
  const client = useQueryClient();
  const regions = useQuery({
    queryKey: ['regions'],
    queryFn: getRegions,
    enabled,
    staleTime: Infinity,
  });
  const drawings = useQuery({
    queryKey: ['global-drawings'],
    queryFn: getGlobalDrawings,
    enabled,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!enabled) return;
    const stopRegions = onSnapshot(
      collection(db, 'regions'),
      (snap) =>
        client.setQueryData(
          ['regions'],
          snap.docs.map((d) => normalizeRegion(d.id, d.data() as RawRegionDocument)),
        ),
      () => {
        void client.invalidateQueries({ queryKey: ['regions'] });
      },
    );
    const stopDrawings = onSnapshot(
      globalsRef,
      (snap) =>
        client.setQueryData(
          ['global-drawings'],
          snap.exists() ? (snap.data() as GlobalDrawings) : null,
        ),
      () => {
        void client.invalidateQueries({ queryKey: ['global-drawings'] });
      },
    );
    return () => {
      stopRegions();
      stopDrawings();
    };
  }, [client, enabled]);
  return { regions, drawings };
}
