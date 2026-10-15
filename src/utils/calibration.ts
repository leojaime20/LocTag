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

function legacyRealToPdfPoint(
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

export interface AffineFit {
  coefficients: [number, number, number, number, number, number];
  residuals: number[];
  meanError: number;
  rmse: number;
}

// Center/scale first, then solve with reorthogonalized QR, avoiding normal equations.
export function fitAffine(points: Calibration['points']): AffineFit {
  if (points.length < 3) throw new Error('Cadastre ao menos três pontos não colineares.');
  if (points.some((p) => ![p.realX, p.realY, p.pdfX, p.pdfY].every(Number.isFinite)))
    throw new Error('Todas as coordenadas devem ser números finitos.');
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.realX / n, 0);
  const my = points.reduce((s, p) => s + p.realY / n, 0);
  const sx = points.reduce((max, p) => Math.max(max, Math.abs(p.realX - mx)), 0);
  const sy = points.reduce((max, p) => Math.max(max, Math.abs(p.realY - my)), 0);
  if (!sx || !sy) throw new Error('Pontos degenerados: distribua as referências nos dois eixos.');
  const columns = [
    points.map((p) => (p.realX - mx) / sx),
    points.map((p) => (p.realY - my) / sy),
    points.map(() => 1),
  ];
  const q: number[][] = [];
  const r = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let j = 0; j < 3; j++) {
    const v = [...columns[j]];
    for (let pass = 0; pass < 2; pass++)
      for (let i = 0; i < j; i++) {
        const dot = v.reduce((s, x, k) => s + x * q[i][k], 0);
        r[i][j] += dot;
        v.forEach((_, k) => {
          v[k] -= dot * q[i][k];
        });
      }
    r[j][j] = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (r[j][j] < 1e-8 * Math.sqrt(n))
      throw new Error('Pontos colineares ou quase colineares: calibração instável.');
    q.push(v.map((x) => x / r[j][j]));
  }
  const solve = (values: number[]) => {
    const mean = values.reduce((sum, value) => sum + value / n, 0);
    const b = q.map((col) => col.reduce((s, x, k) => s + x * (values[k] - mean), 0));
    const x = [0, 0, 0];
    for (let i = 2; i >= 0; i--) {
      x[i] = (b[i] - r[i].reduce((s, value, j) => s + (j > i ? value * x[j] : 0), 0)) / r[i][i];
    }
    return [x[0] / sx, x[1] / sy, mean + x[2] - (x[0] * mx) / sx - (x[1] * my) / sy];
  };
  const coefficients = [
    ...solve(points.map((p) => p.pdfX)),
    ...solve(points.map((p) => p.pdfY)),
  ] as AffineFit['coefficients'];
  const [a, b, , d, e] = coefficients;
  if (
    !coefficients.every(Number.isFinite) ||
    Math.abs(a * e - b * d) <= 1e-10 * Math.hypot(a, d) * Math.hypot(b, e)
  )
    throw new Error('Transformação singular: os pontos no PDF não definem uma área válida.');
  const residuals = points.map((p) => {
    const actual = applyAffine(coefficients, p.realX, p.realY);
    return Math.hypot(actual.x - p.pdfX, actual.y - p.pdfY);
  });
  return {
    coefficients,
    residuals,
    meanError: residuals.reduce((s, r) => s + r / n, 0),
    rmse: Math.sqrt(residuals.reduce((s, r) => s + (r * r) / n, 0)),
  };
}
export function applyAffine(
  [a, b, c, d, e, f]: AffineFit['coefficients'],
  x: number,
  y: number,
): PdfPoint {
  return { x: a * x + b * y + c, y: d * x + e * y + f };
}
export function realToPdfPoint(
  tag: EquipmentTag,
  view: ViewKind,
  calibration: Calibration,
): PdfPoint {
  if (![tag.x, tag.y, tag.z].every(Number.isFinite))
    throw new Error('Coordenadas da TAG inválidas.');
  if (calibration.model !== 'affine') return legacyRealToPdfPoint(tag, view, calibration);
  return applyAffine(
    fitAffine(calibration.points).coefficients,
    tag.x,
    view === 'plant' ? tag.y : tag.z,
  );
}
