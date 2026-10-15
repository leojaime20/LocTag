import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase/config';
import { resolveStorageUrl } from '../services/firebase/storage';
import { normalizeTag } from '../types/firebase';
import type { EquipmentTag, SelectedTagContext, VolumeRegion } from '../types/domain';
import { hasValidBounds, resolveRegion } from '../utils/regions';
import { useSpatialData } from './useSpatialData';

export function useSelectedTagContext(selected: EquipmentTag | null) {
  const client = useQueryClient();
  const spatial = useSpatialData(Boolean(selected));
  const liveTag = useQuery({
    queryKey: ['tag', selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const snapshot = await getDoc(doc(db, 'tags', selected!.id));
      return snapshot.exists() ? normalizeTag(snapshot.id, snapshot.data()) : null;
    },
  });
  const id = selected?.id;
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'tags', id),
      (snap) =>
        client.setQueryData(['tag', id], snap.exists() ? normalizeTag(snap.id, snap.data()) : null),
      () => {
        void client.invalidateQueries({ queryKey: ['tag', id] });
      },
    );
  }, [client, id]);
  const tag = liveTag.data === undefined ? selected : liveTag.data;
  const regions = spatial.regions.data ?? [];
  const resolution = tag
    ? resolveRegion(tag, regions.filter((r) => !r.archived && hasValidBounds(r)) as VolumeRegion[])
    : null;
  const configuredDrawings = spatial.drawings.data ?? null;
  const drawings =
    configuredDrawings?.exampleRegionId &&
    resolution?.region?.id !== configuredDrawings.exampleRegionId
      ? null
      : configuredDrawings;
  const legacyRegion = !drawings ? (regions.find((r) => r.id === tag?.regionId) ?? null) : null;
  const paths = [
    drawings?.plant.path ?? legacyRegion?.plantPdf ?? '',
    drawings?.side.path ?? legacyRegion?.sidePdf ?? '',
  ];
  const urls = useQuery({
    queryKey: ['drawing-urls', ...paths],
    queryFn: () => Promise.all(paths.map(resolveStorageUrl)),
    enabled: Boolean(tag) && spatial.drawings.isSuccess && spatial.regions.isSuccess,
    staleTime: Infinity,
  });
  const data: SelectedTagContext | null =
    tag && urls.data && resolution
      ? {
          tag,
          drawings,
          legacyRegion,
          resolution,
          plantPdfUrl: urls.data[0],
          sidePdfUrl: urls.data[1],
        }
      : null;
  return {
    data,
    isFetching:
      Boolean(selected) &&
      !data &&
      liveTag.data !== null &&
      !liveTag.isError &&
      !urls.isError &&
      !spatial.regions.isError &&
      !spatial.drawings.isError,
    isError:
      liveTag.isError ||
      urls.isError ||
      spatial.regions.isError ||
      spatial.drawings.isError ||
      Boolean(selected && liveTag.data === null),
  };
}
