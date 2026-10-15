import { test, expect } from '@playwright/test';
import { fitAffine, applyAffine, realToPdfPoint } from '../src/utils/calibration';
import { hasValidBounds, regionConflict, resolveRegion } from '../src/utils/regions';
import { parseCsv, tagsToCsv, validateTagRows } from '../src/utils/csv';
import { pageToScreen, screenToPage, viewportRect } from '../src/utils/viewport';
import type { EquipmentTag, VolumeRegion } from '../src/types/domain';
const tag: EquipmentTag = {
  id: 'P%2F1',
  tag: 'P/1',
  description: 'Bomba, "água"\r\nSegundo circuito; teste',
  regionId: '',
  x: 5,
  y: 5,
  z: 5,
  type: 'Processo',
  status: 'active',
};
const r: VolumeRegion = {
  id: 'a',
  name: 'A',
  xMin: 0,
  xMax: 10,
  yMin: 0,
  yMax: 10,
  zMin: 0,
  zMax: 10,
};
test('afim recupera rotação, cisalhamento, translação e escala em coordenadas grandes', () => {
  const expected: [number, number, number, number, number, number] = [2, 0.3, 50, -0.7, -4, 600];
  const points = Array.from({ length: 30 }, (_, i) => {
    const realX = 1e6 + (i % 6) * 10,
      realY = 2e6 + Math.floor(i / 6) * 20;
    const p = applyAffine(expected, realX, realY);
    return { realX, realY, pdfX: p.x, pdfY: p.y };
  });
  const fit = fitAffine(points);
  fit.coefficients.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 5));
  expect(fit.rmse).toBeLessThan(1e-6);
  const calibration = { id: 'a', pdfId: 'a', model: 'affine' as const, points };
  expect(realToPdfPoint({ ...tag, y: 9, z: 2 }, 'plant', calibration).y).toBeCloseTo(
    -0.7 * 5 - 4 * 9 + 600,
    5,
  );
  expect(realToPdfPoint({ ...tag, y: 9, z: 2 }, 'side', calibration).y).toBeCloseTo(
    -0.7 * 5 - 4 * 2 + 600,
    5,
  );
});
test('calibração rejeita insuficiência, colinearidade, não finitos e transformação singular', () => {
  expect(() => fitAffine([])).toThrow();
  expect(() =>
    fitAffine([0, 1, 2, 3].map((i) => ({ realX: i, realY: i, pdfX: i, pdfY: i }))),
  ).toThrow();
  const valid = [
    { realX: 0, realY: 0, pdfX: 0, pdfY: 0 },
    { realX: 1, realY: 0, pdfX: 1, pdfY: 0 },
    { realX: 0, realY: 1, pdfX: 0, pdfY: 1 },
  ];
  expect(() => fitAffine(valid.map((p) => ({ ...p, pdfY: 0 })))).toThrow();
  expect(() => fitAffine([...valid, { realX: NaN, realY: 1, pdfX: 2, pdfY: 2 }])).toThrow();
  const noisy = fitAffine([...valid, { realX: 1, realY: 1, pdfX: 2, pdfY: 2 }]);
  expect(noisy.rmse).toBeGreaterThan(0);
  expect(noisy.residuals).toHaveLength(4);
});
test('regiões distinguem volume, contenção, face, aresta, ponto e separação', () => {
  expect(regionConflict(r, { ...r, xMin: 5, xMax: 15 })).toBe('Sobreposição parcial');
  expect(regionConflict(r, { ...r, xMin: 2, xMax: 8 })).toBe('Contenção total');
  for (const extra of [{}, { yMin: 10, yMax: 20 }, { yMin: 10, yMax: 20, zMin: 10, zMax: 20 }])
    expect(regionConflict(r, { ...r, xMin: 10, xMax: 20, ...extra })).toContain('Contato');
  expect(regionConflict(r, { ...r, zMin: 11, zMax: 20 })).toBeNull();
  expect(hasValidBounds({ ...r, zMax: NaN })).toBe(false);
});
test('região dinâmica e altura sem persistência ou escolha arbitrária', () => {
  expect(resolveRegion(tag, [r]).height).toBe(5);
  expect(resolveRegion({ ...tag, z: 20 }, [r]).height).toBeNull();
  const other = { ...r, id: 'b', name: 'B', zMin: 2 };
  expect(resolveRegion(tag, [r, other]).region).toBeNull();
  expect(resolveRegion({ ...tag, regionId: 'b' }, [r, other]).height).toBe(3);
  expect(resolveRegion({ ...tag, z: 0 }, [r]).height).toBe(0);
  expect(tag.regionId).toBe('');
});
test('CSV faz ida e volta sem perder vírgula, aspas, quebras, acentos, ID e regionId vazio', () => {
  const parsed = parseCsv(tagsToCsv([tag]));
  expect(parsed.errors).toEqual([]);
  const validated = validateTagRows(parsed.rows, parsed.lineNumbers);
  expect(validated.errors).toEqual([]);
  expect(validated.tags).toEqual([tag]);
});
test('CSV aceita delimitadores legados e rejeita números vazios, status, IDs duplicados e aspas', () => {
  const header = 'tag;description;regionId;x;y;z;type;status';
  expect(
    validateTagRows(parseCsv(`${header}\nP1;Bomba;;1;2;3;Bomba;active`).rows).tags,
  ).toHaveLength(1);
  const invalid = validateTagRows(parseCsv(`${header}\nP1;Bomba;;;2;3;Bomba;ligado`).rows);
  expect(invalid.invalidCount).toBe(1);
  expect(invalid.tags).toHaveLength(0);
  expect(invalid.errors).toHaveLength(2);
  expect(parseCsv(`${header}\nP1;"aberto`).errors.length).toBeGreaterThan(0);
  expect(parseCsv(`${header}\nP1;Bomba`).invalidCount).toBe(1);
  expect(
    validateTagRows([
      { ...parseCsv(tagsToCsv([tag])).rows[0] },
      { ...parseCsv(tagsToCsv([tag])).rows[0], tag: 'OUTRA' },
    ]).errors.join(),
  ).toContain('ID duplicado');
  expect(parseCsv('tag,tag\na,b').errors.join()).toContain('duplicados');
});
test('referencial PDF/tela é estável em zoom, pan, limites e redimensionamento', () => {
  for (const zoom of [1, 3, 20])
    for (const size of [
      { width: 400, height: 600 },
      { width: 1200, height: 700 },
    ]) {
      const rect = viewportRect({ width: 800, height: 600 }, size, {
        zoom,
        centerX: 790,
        centerY: 2,
      });
      const p = { x: 200, y: 150 };
      expect(screenToPage(pageToScreen(p, rect, size), rect, size)).toEqual(p);
      expect(rect.x + rect.width).toBeGreaterThanOrEqual(800);
    }
});
