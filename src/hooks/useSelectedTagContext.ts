import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getDoc, onSnapshot } from 'firebase/firestore';
import { LEGACY_PROJECT_ID, projectDoc } from '../services/api/projects';
import { resolveStorageUrl } from '../services/firebase/storage';
import { normalizeTag } from '../types/firebase';
import type { EquipmentTag, Region, SelectedTagContext, VolumeRegion } from '../types/domain';
import { hasValidBounds, resolveRegion } from '../utils/regions';
import { useSpatialData } from './useSpatialData';
const emptyRegions: Region[] = [];

export function useSelectedTagContext(
  selected: EquipmentTag | null,
  projectId = LEGACY_PROJECT_ID,
) {
  const client = useQueryClient();
  const spatial = useSpatialData(Boolean(selected), projectId);
  const liveTag = useQuery({
    queryKey: ['tag', projectId, selected?.id],
    enabled: Boolean(selected),
    queryFn: async () => {
      const snapshot = await getDoc(projectDoc(projectId, 'tags', selected!.id));
      return snapshot.exists() ? normalizeTag(snapshot.id, snapshot.data()) : null;
    },
  });
  const id = selected?.id;
  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      projectDoc(projectId, 'tags', id),
      (snap) =>
        client.setQueryData(
          ['tag', projectId, id],
          snap.exists() ? normalizeTag(snap.id, snap.data()) : null,
        ),
      () => {
        void client.invalidateQueries({ queryKey: ['tag', projectId, id] });
      },
    );
  }, [client, id, projectId]);
  const tag = liveTag.data === undefined ? selected : liveTag.data;
  const regions = spatial.regions.data ?? emptyRegions;
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
    queryKey: ['drawing-urls', projectId, ...paths],
    queryFn: () => Promise.all(paths.map(resolveStorageUrl)),
    enabled: Boolean(tag) && spatial.drawings.isSuccess && spatial.regions.isSuccess,
    staleTime: Infinity,
  });
  const data: SelectedTagContext | null =
    tag && resolution && spatial.regions.isSuccess && !spatial.regions.isError && !liveTag.isError
      ? {
          tag,
          drawings,
          legacyRegion,
          resolution,
          plantPdfUrl: urls.data?.[0] ?? null,
          sidePdfUrl: urls.data?.[1] ?? null,
          drawingsLoading:
            spatial.drawings.isPending || (urls.isPending && !spatial.drawings.isError),
          drawingsError: spatial.drawings.isError || urls.isError,
        }
      : null;
  return {
    data,
    regions,
    isFetching:
      Boolean(selected) &&
      !data &&
      liveTag.data !== null &&
      !liveTag.isError &&
      !spatial.regions.isError,
    isError:
      liveTag.isError || spatial.regions.isError || Boolean(selected && liveTag.data === null),
  };
}
