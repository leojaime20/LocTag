import type { EquipmentTag, RegionBounds, RegionResolution, VolumeRegion } from '../types/domain';
export function hasValidBounds(region: Partial<RegionBounds>): region is RegionBounds {
  return (['x', 'y', 'z'] as const).every((axis) => {
    const min = region[`${axis}Min`],
      max = region[`${axis}Max`];
    return (
      typeof min === 'number' &&
      typeof max === 'number' &&
      Number.isFinite(min) &&
      Number.isFinite(max) &&
      min < max
    );
  });
}
export function isInsideRegion(tag: Pick<EquipmentTag, 'x' | 'y' | 'z'>, region: RegionBounds) {
  return (['x', 'y', 'z'] as const).every(
    (axis) =>
      Number.isFinite(tag[axis]) &&
      tag[axis] >= region[`${axis}Min`] &&
      tag[axis] <= region[`${axis}Max`],
  );
}
export function regionConflict(a: RegionBounds, b: RegionBounds): string | null {
  const overlap = (['x', 'y', 'z'] as const).map(
    (axis) =>
      Math.min(a[`${axis}Max`], b[`${axis}Max`]) - Math.max(a[`${axis}Min`], b[`${axis}Min`]),
  );
  if (overlap.some((d) => d < 0)) return null;
  if (overlap.some((d) => d === 0))
    return 'Contato de fronteira (pode gerar ambiguidade no limite)';
  const contains = (one: RegionBounds, other: RegionBounds) =>
    (['x', 'y', 'z'] as const).every(
      (axis) =>
        one[`${axis}Min`] <= other[`${axis}Min`] && one[`${axis}Max`] >= other[`${axis}Max`],
    );
  return contains(a, b) || contains(b, a) ? 'Contenção total' : 'Sobreposição parcial';
}
export function resolveRegion(tag: EquipmentTag, regions: VolumeRegion[]): RegionResolution {
  const matches = regions.filter((r) => hasValidBounds(r) && isInsideRegion(tag, r));
  const region =
    matches.length === 1 ? matches[0] : (matches.find((r) => r.id === tag.regionId) ?? null);
  return {
    region,
    matches,
    label:
      region?.name ??
      (matches.length
        ? `Região ambígua: ${matches.map((r) => r.name).join(', ')}`
        : 'Região não identificada'),
    height: region ? Math.max(0, tag.z - region.zMin) : null,
  };
}
