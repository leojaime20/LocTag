import type { Calibration, EquipmentTag, ViewKind } from '../types/domain';

export interface PdfPoint {
  x: number;
  y: number;
}

export interface Transform2D {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
  rotationRad: number;
}

function buildTransform(calibration: Calibration): Transform2D {
  const [first, second] = calibration.points;
  const fallbackScale = calibration.scale ?? 1;

  if (!first || !second || first.realX === second.realX || first.realY === second.realY) {
    return {
      scaleX: fallbackScale,
      scaleY: fallbackScale,
      translateX: calibration.translateX ?? 0,
      translateY: calibration.translateY ?? 0,
      rotationRad: ((calibration.rotationDeg ?? 0) * Math.PI) / 180,
    };
  }

  const scaleX = (second.pdfX - first.pdfX) / (second.realX - first.realX);
  const scaleY = (second.pdfY - first.pdfY) / (second.realY - first.realY);

  return {
    scaleX,
    scaleY,
    translateX: first.pdfX - first.realX * scaleX + (calibration.translateX ?? 0),
    translateY: first.pdfY - first.realY * scaleY + (calibration.translateY ?? 0),
    rotationRad: ((calibration.rotationDeg ?? 0) * Math.PI) / 180,
  };
}

export function realToPdfPoint(
  tag: EquipmentTag,
  view: ViewKind,
  calibration: Calibration,
): PdfPoint {
  const transform = buildTransform(calibration);
  const realX = tag.x;
  const realY = view === 'plant' ? tag.y : tag.z;
  const scaledX = realX * transform.scaleX;
  const scaledY = realY * transform.scaleY;
  const cos = Math.cos(transform.rotationRad);
  const sin = Math.sin(transform.rotationRad);

  return {
    x: scaledX * cos - scaledY * sin + transform.translateX,
    y: scaledX * sin + scaledY * cos + transform.translateY,
  };
}
