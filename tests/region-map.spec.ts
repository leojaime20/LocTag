import { expect, test } from '@playwright/test';
import type { Region } from '../src/types/domain';
import { analyzeRegions, boundsSize, cutRegion, enclosingBounds } from '../src/utils/regionMap';

const base: Region = {
  id: 'a',
  name: 'A',
  xMin: -10,
  xMax: 0,
  yMin: 1000,
  yMax: 1010,
  zMin: -2,
  zMax: 8,
  plantPdf: '',
  sidePdf: '',
  plantCalibration: { id: '', pdfId: '', points: [] },
  sideCalibration: { id: '', pdfId: '', points: [] },
};

test('análise diferencia contatos, contenção e interseção e exclui arquivadas e inválidas', () => {
  const analysis = analyzeRegions([
    base,
    { ...base, id: 'overlap', xMin: -2, xMax: 5 },
    { ...base, id: 'inside', xMin: -8, xMax: -5, zMin: 0, zMax: 1 },
    { ...base, id: 'face', zMin: 8, zMax: 12 },
    { ...base, id: 'edge', xMin: 0, xMax: 10, zMin: 8, zMax: 10 },
    { ...base, id: 'point', xMin: 0, xMax: 10, yMin: 1010, yMax: 1020, zMin: 8, zMax: 10 },
    { ...base, id: 'separate', zMin: 20, zMax: 30 },
    { ...base, id: 'archived', archived: true },
    { ...base, id: 'missing', zMax: undefined },
    { ...base, id: 'invalid', xMax: -20 },
  ]);
  expect(analysis.pending.map((region) => region.id)).toEqual(['missing', 'invalid']);
  expect(analysis.volumes).toHaveLength(7);
  const pairs = analysis.conflicts.filter((conflict) => conflict.a.id === 'a');
  expect(pairs.filter((conflict) => conflict.contact).map((conflict) => conflict.b.id)).toEqual([
    'face',
    'edge',
    'point',
  ]);
  const overlap = pairs.find((conflict) => conflict.b.id === 'overlap')!;
  expect(overlap.contact).toBe(false);
  expect(boundsSize(overlap.intersection)).toEqual([2, 10, 10]);
  expect(pairs.find((conflict) => conflict.b.id === 'inside')?.label).toBe('Contenção total');
  expect(pairs.find((conflict) => conflict.b.id === 'separate')).toBeUndefined();
});

test('corte respeita Z real sem alterar os limites usados no diagnóstico', () => {
  const region = analyzeRegions([base]).volumes[0];
  expect(cutRegion(region, -2)).toBeNull();
  expect(cutRegion(region, -3)).toBeNull();
  expect(cutRegion(region, 2)?.zMax).toBe(2);
  expect(cutRegion(region, 20)?.zMax).toBe(8);
  expect(cutRegion(region, null)?.zMax).toBe(8);
  expect(region.zMax).toBe(8);
  expect(enclosingBounds([region, { ...region, xMin: -100, zMax: 20 }])).toMatchObject({
    xMin: -100,
    xMax: 0,
    yMin: 1000,
    yMax: 1010,
    zMin: -2,
    zMax: 20,
  });
  expect(enclosingBounds([])).toBeNull();
});

test('mapa renderiza, gira, enquadra e seleciona regiões sem erros', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/fixtures/region-map.html');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await expect(page.getByText('5 de 5 blocos visíveis', { exact: true })).toBeVisible();
  const before = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  await page.getByRole('button', { name: 'Superior · XY' }).click();
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  // Selecting in the scene works independently of the list.
  await page.getByLabel('Buscar região no mapa').fill('Módulo separado');
  const focusedBox = (await canvas.boundingBox())!;
  await canvas.click({ position: { x: focusedBox.width / 2, y: focusedBox.height / 2 } });
  await expect(page.getByLabel('Detalhes da região selecionada')).toContainText('Módulo separado');
  await page.getByRole('button', { name: 'Restaurar visualização' }).click();
  await page.getByRole('button', { name: 'Selecionar Deck A', exact: true }).click();
  await expect(page.getByLabel('Detalhes da região selecionada')).toContainText('10 × 10 × 5 m');
  await page.getByRole('button', { name: 'Isolar região', exact: true }).click();
  await expect(page.getByText('1 de 5 blocos visíveis', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('diagnósticos permanecem completos com filtros, isolamento e corte; dados atualizam', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/region-map.html');
  const summary = page.getByLabel('Resumo da análise');
  await expect(summary).toContainText('2 sobreposições');
  await expect(summary).toContainText('2 contatos de fronteira');
  await expect(summary).toContainText('2 pendências');
  await expect(page.getByText('Região legada (legacy)', { exact: true })).toBeVisible();
  await page.getByLabel('Buscar região no mapa').fill('separado');
  await expect(page.getByText('1 de 5 blocos visíveis', { exact: true })).toBeVisible();
  await expect(summary).toContainText('2 sobreposições');
  await page.getByRole('button', { name: /Deck A ↔ Deck B/ }).click();
  await expect(page.getByText('2 de 5 blocos visíveis', { exact: true })).toBeVisible();
  await expect(page.getByText('Sobreposição parcial · interseção: 100 m³')).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar visualização' }).click();
  await page.getByLabel('Exibir Deck B', { exact: true }).uncheck();
  await expect(page.getByText('4 de 5 blocos visíveis', { exact: true })).toBeVisible();
  await page.getByLabel('Corte horizontal por altura Z').check();
  const slider = page.getByLabel('Altura do corte (m)');
  await slider.fill('4');
  await expect(page.getByText('3 de 5 blocos visíveis', { exact: true })).toBeVisible();
  await expect(summary).toContainText('2 sobreposições');
  await slider.fill('0');
  await expect(page.getByText('Nenhum bloco visível.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Restaurar visualização' }).click();
  await page.getByLabel('Incluir arquivadas (1)').check();
  await expect(page.getByText('6 de 6 blocos visíveis', { exact: true })).toBeVisible();
  await expect(summary).toContainText('2 sobreposições');
  await page.getByRole('button', { name: 'Simular atualização das regiões' }).click();
  await expect(summary).toContainText('1 sobreposições');
  await expect(page.getByRole('button', { name: 'Selecionar Deck B', exact: true })).toHaveCount(0);
});

test('mapa funciona em tela estreita e apresenta estados vazios', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tests/fixtures/region-map.html');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Selecionar Deck C', exact: true }).click();
  await expect(page.getByLabel('Detalhes da região selecionada')).toContainText('Z: 5 a 10 m');
  await page.goto('/tests/fixtures/region-map.html?empty');
  await expect(page.getByText(/Nenhuma região com limites válidos disponível/)).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.goto('/tests/fixtures/region-map.html?invalid');
  await expect(page.getByLabel('Resumo da análise')).toContainText('2 pendências');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('falha de WebGL mantém a lista e os diagnósticos disponíveis', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/tests/fixtures/region-map.html');
  await expect(page.getByRole('alert')).toContainText(/WebGL/);
  await expect(page.getByLabel('Resumo da análise')).toContainText('2 sobreposições');
  await page.getByRole('button', { name: 'Selecionar Deck A', exact: true }).click();
  await expect(page.getByLabel('Detalhes da região selecionada')).toContainText('Deck A');
});
