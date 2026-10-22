import type { Region, RegionBounds, VolumeRegion } from '../types/domain';
import { hasValidBounds, regionConflict } from './regions';

export type MappedRegion = Region & VolumeRegion;
export type RegionMapView = 'iso' | 'top' | 'front' | 'side';
export interface RegionMapConflict {
  a: MappedRegion;
  b: MappedRegion;
  label: string;
  intersection: RegionBounds;
  contact: boolean;
}

export function analyzeRegions(regions: Region[]) {
  const active = regions.filter((region) => !region.archived);
  const volumes = active.filter((region): region is MappedRegion => hasValidBounds(region));
  const pending = active.filter((region) => !hasValidBounds(region));
  const conflicts: RegionMapConflict[] = [];
  for (let i = 0; i < volumes.length; i++) {
    for (let j = i + 1; j < volumes.length; j++) {
      const a = volumes[i],
        b = volumes[j];
      const label = regionConflict(a, b);
      if (!label) continue;
      const intersection = {
        xMin: Math.max(a.xMin, b.xMin),
        xMax: Math.min(a.xMax, b.xMax),
        yMin: Math.max(a.yMin, b.yMin),
        yMax: Math.min(a.yMax, b.yMax),
        zMin: Math.max(a.zMin, b.zMin),
        zMax: Math.min(a.zMax, b.zMax),
      };
      conflicts.push({ a, b, label, intersection, contact: !hasValidBounds(intersection) });
    }
  }
  return { volumes, pending, conflicts };
}

export function enclosingBounds(regions: RegionBounds[]): RegionBounds | null {
  if (!regions.length) return null;
  return regions.reduce(
    (bounds, region) => ({
      xMin: Math.min(bounds.xMin, region.xMin),
      xMax: Math.max(bounds.xMax, region.xMax),
      yMin: Math.min(bounds.yMin, region.yMin),
      yMax: Math.max(bounds.yMax, region.yMax),
      zMin: Math.min(bounds.zMin, region.zMin),
      zMax: Math.max(bounds.zMax, region.zMax),
    }),
    { ...regions[0] },
  );
}

// A closed section through Z, preserving the original region and its analysis.
export function cutRegion(bounds: RegionBounds, height: number | null): RegionBounds | null {
  if (height === null) return bounds;
  if (height <= bounds.zMin) return null;
  return { ...bounds, zMax: Math.min(height, bounds.zMax) };
}

export function boundsCenter(bounds: RegionBounds): [number, number, number] {
  return [
    bounds.xMin / 2 + bounds.xMax / 2,
    bounds.yMin / 2 + bounds.yMax / 2,
    bounds.zMin / 2 + bounds.zMax / 2,
  ];
}

export function boundsSize(bounds: RegionBounds): [number, number, number] {
  return [bounds.xMax - bounds.xMin, bounds.yMax - bounds.yMin, bounds.zMax - bounds.zMin];
}

export function regionColor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return `hsl(${((hash % 360) + 360) % 360}, 58%, 48%)`;
}
