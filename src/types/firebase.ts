import type { Calibration, EquipmentTag, Region, RegionBounds, TagStatus } from './domain';

interface LegacyPoint {
  x?: number;
  y?: number;
  z?: number;
}

export interface RawTagDocument {
  tag?: string;
  description?: string;
  descricao?: string;
  regionId?: string;
  x?: number;
  y?: number;
  z?: number;
  type?: string;
  sistema?: string;
  deck?: string;
  area?: string;
  status?: TagStatus;
  planta?: LegacyPoint;
  lateral?: LegacyPoint;
}

export interface RawRegionDocument extends Partial<RegionBounds> {
  archived?: boolean;
  name?: string;
  plantPdf?: string;
  sidePdf?: string;
  plantCalibration?: Partial<Calibration>;
  sideCalibration?: Partial<Calibration>;
}

const defaultCalibration = (id: string, pdfId: string): Calibration => ({
  id,
  pdfId,
  points: [
    { realX: 0, realY: 0, pdfX: 0, pdfY: 0 },
    { realX: 1000, realY: 500, pdfX: 1000, pdfY: 500 },
  ],
  rotationDeg: 0,
});

export const fallbackRegion: Region = {
  id: 'default',
  name: 'Região padrão',
  plantPdf: '',
  sidePdf: '',
  plantCalibration: defaultCalibration('default-plant', 'plant'),
  sideCalibration: defaultCalibration('default-side', 'side'),
};

export function normalizeTag(id: string, data: RawTagDocument): EquipmentTag {
  return {
    id,
    tag: data.tag ?? id,
    description: data.description ?? data.descricao ?? 'Sem descrição',
    regionId: data.regionId ?? '',
    x: data.x ?? data.planta?.x ?? NaN,
    y: data.y ?? data.planta?.y ?? NaN,
    z: data.z ?? data.lateral?.z ?? data.lateral?.y ?? NaN,
    type: data.type ?? data.sistema ?? 'Equipamento',
    status: data.status ?? 'unknown',
  };
}

export function normalizeRegion(id: string, data: RawRegionDocument): Region {
  return {
    id,
    name: data.name ?? fallbackRegion.name,
    archived: data.archived,
    xMin: data.xMin,
    xMax: data.xMax,
    yMin: data.yMin,
    yMax: data.yMax,
    zMin: data.zMin,
    zMax: data.zMax,
    plantPdf: data.plantPdf ?? '',
    sidePdf: data.sidePdf ?? '',
    plantCalibration: {
      ...fallbackRegion.plantCalibration,
      ...data.plantCalibration,
      id: data.plantCalibration?.id ?? `${id}-plant`,
      pdfId: data.plantCalibration?.pdfId ?? `${id}-plant`,
      points: data.plantCalibration?.points ?? fallbackRegion.plantCalibration.points,
    },
    sideCalibration: {
      ...fallbackRegion.sideCalibration,
      ...data.sideCalibration,
      id: data.sideCalibration?.id ?? `${id}-side`,
      pdfId: data.sideCalibration?.pdfId ?? `${id}-side`,
      points: data.sideCalibration?.points ?? fallbackRegion.sideCalibration.points,
    },
  };
}
