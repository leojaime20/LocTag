export type ViewKind = 'plant' | 'side';
export type TagStatus = 'active' | 'inactive' | 'unknown';

export interface CalibrationPoint {
  realX: number;
  realY: number; // Y na planta, Z na lateral; metros.
  pdfX: number;
  pdfY: number;
}
export interface Calibration {
  id: string;
  pdfId: string;
  points: CalibrationPoint[];
  model?: 'affine';
  tolerance?: number; // unidades da página PDF (pontos), não pixels de tela
  scale?: number;
  translateX?: number;
  translateY?: number;
  rotationDeg?: number;
}
export interface RegionBounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
}
// Os campos legados permanecem para leitura durante a transição.
export interface Region extends Partial<RegionBounds> {
  id: string;
  name: string;
  archived?: boolean;
  plantPdf: string;
  sidePdf: string;
  plantCalibration: Calibration;
  sideCalibration: Calibration;
}
export interface VolumeRegion extends RegionBounds {
  id: string;
  name: string;
}
export interface Drawing {
  path: string;
  pageIndex: number;
  calibration: Calibration;
  page?: { width: number; height: number; rotation: number };
}
export interface GlobalDrawings {
  version: 2;
  units: 'm';
  exampleRegionId?: string; // restringe o desenho ilustrativo a uma região espacial
  initialZoom: number; // multiplicador do ajuste à página
  shareZoom: number;
  plant: Drawing;
  side: Drawing;
}
export interface EquipmentTag {
  id: string;
  tag: string;
  description: string;
  regionId: string;
  moduleRegion?: string;
  owner?: string;
  elevation?: string;
  x: number;
  y: number;
  z: number;
  type: string;
  status: TagStatus;
}
export interface RegionResolution {
  region: VolumeRegion | null;
  matches: VolumeRegion[];
  label: string;
  height: number | null;
}
export interface SelectedTagContext {
  drawingsLoading?: boolean;
  drawingsError?: boolean;
  tag: EquipmentTag;
  resolution: RegionResolution;
  drawings: GlobalDrawings | null;
  legacyRegion: Region | null;
  plantPdfUrl: string | null;
  sidePdfUrl: string | null;
}
