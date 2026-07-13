export type ViewKind = 'plant' | 'side';
export type TagStatus = 'active' | 'inactive' | 'unknown';

export interface CalibrationPoint {
  realX: number;
  realY: number;
  pdfX: number;
  pdfY: number;
}

export interface Calibration {
  id: string;
  pdfId: string;
  points: CalibrationPoint[];
  scale?: number;
  translateX?: number;
  translateY?: number;
  rotationDeg?: number;
}

export interface Region {
  id: string;
  name: string;
  plantPdf: string;
  sidePdf: string;
  plantCalibration: Calibration;
  sideCalibration: Calibration;
}

export interface EquipmentTag {
  id: string;
  tag: string;
  description: string;
  regionId: string;
  x: number;
  y: number;
  z: number;
  type: string;
  status: TagStatus;
}

export interface SelectedTagContext {
  tag: EquipmentTag;
  region: Region;
  plantPdfUrl: string | null;
  sidePdfUrl: string | null;
}
