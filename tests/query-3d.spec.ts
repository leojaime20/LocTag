import { expect, test } from '@playwright/test';

test('3D carrega sob demanda sem nomes, preserva câmera e PDFs no celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const requests: string[] = [],
    errors: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const labels: string[] = [];
    Object.defineProperty(window, 'paintedLabels', { value: labels });
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      labels.push(args[0]);
      return original.apply(this, args);
    };
  });
  await page.goto('/tests/fixtures/viewer.html');
  await expect(page.locator('.pdf-layer[alt="Desenho técnico"]')).toHaveCount(2);
  expect(requests.some((url) => /RegionScene|TagRegionViewer|react-three/.test(url))).toBe(false);
  const pdfLoads = requests.filter((url) => url.endsWith('/drawing.pdf')).length;
  await page.getByRole('button', { name: 'Recolher', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Visualizações no celular' });
  await nav.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expandir', exact: true })).toBeVisible();
  await expect(page.getByText('Região de teste', { exact: true })).toBeVisible();
  const canvas = page.locator('.tag-region-canvas canvas');
  await expect(canvas).toBeVisible();
  await expect(page.locator('.pdf-viewport:visible')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Compartilhar', exact: true })).toHaveCount(0);
  const initial = await canvas.screenshot();
  await page.getByRole('button', { name: 'Aumentar zoom 3D' }).click();
  await expect.poll(async () => (await canvas.screenshot()).equals(initial)).toBe(false);
  const before = await canvas.screenshot();
  await nav.getByRole('button', { name: 'Lateral', exact: true }).click();
  await expect(canvas).toHaveCount(0);
  await nav.getByRole('button', { name: '3D', exact: true }).click();
  await expect(canvas).toBeVisible();
  await expect.poll(async () => (await canvas.screenshot()).equals(before)).toBe(true);
  await page.getByRole('button', { name: 'Expandir 3D' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Sair da expansão' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Expandir 3D' })).toBeFocused();
  await page.getByRole('button', { name: 'Alternar TAG' }).click();
  await expect(
    page.getByRole('region', { name: 'Localização 3D de P-202', exact: true }),
  ).toBeVisible();
  await expect(nav.getByRole('button', { name: '3D', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  const labels = await page.evaluate(() => Reflect.get(window, 'paintedLabels') as string[]);
  expect(labels.filter((label) => label.includes('Região'))).toEqual([]);
  expect(requests.filter((url) => url.endsWith('/drawing.pdf'))).toHaveLength(pdfLoads);
  expect(errors).toEqual([]);
});

test('3D mantém layout utilizável em telas estreitas e paisagem', async ({ page }) => {
  await page.goto('/tests/fixtures/viewer.html?noPdf');
  for (const [width, height] of [
    [320, 640],
    [360, 800],
    [390, 844],
    [430, 932],
    [740, 360],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await page.getByRole('button', { name: '3D', exact: true }).filter({ visible: true }).click();
    await expect(page.locator('.tag-region-canvas canvas')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    await page.getByRole('button', { name: 'Expandir 3D' }).click();
    const close = page.getByRole('button', { name: 'Sair da expansão' });
    await expect(close).toBeInViewport();
    const bounds = (await close.boundingBox())!;
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    await close.click();
  }
});

test('TAG externa, coordenadas inválidas e ausência de volumes têm estados distintos', async ({
  page,
}) => {
  for (const [param, message, canvasCount] of [
    ['outside', 'A TAG está fora das regiões cadastradas.', 1],
    ['empty', 'Nenhuma região com volume válido disponível.', 1],
    ['invalid', 'A TAG possui coordenadas inválidas.', 0],
  ] as const) {
    await page.goto(`/tests/fixtures/viewer.html?noPdf&${param}`);
    await page.getByRole('button', { name: '3D', exact: true }).filter({ visible: true }).click();
    await expect(page.getByText(message, { exact: false })).toBeVisible();
    await expect(page.locator('.tag-region-canvas canvas')).toHaveCount(canvasCount);
  }
});

test('sem WebGL o resumo e as abas continuam disponíveis', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.startsWith('webgl')) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto('/tests/fixtures/viewer.html?noPdf');
  await page.getByRole('button', { name: '3D', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('alert')).toContainText('WebGL');
  await page.getByRole('button', { name: 'Desenhos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'P-101A', exact: true })).toBeVisible();
});

test('contexto espacial continua disponível quando a URL do PDF falha', async ({ page }) => {
  await page.route('**/src/services/firebase/storage.ts', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'export async function resolveStorageUrl() { throw new Error("PDF indisponível"); }',
    }),
  );
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await page.goto('/tests/fixtures/selected-context.html');
  await expect
    .poll(async () => JSON.parse((await page.getByTestId('context-state').textContent())!).pdfError)
    .toBe(true);
  const state = JSON.parse((await page.getByTestId('context-state').textContent())!);
  expect(state).toEqual({
    ready: true,
    region: 'Região real',
    x: 2,
    pdfError: true,
    hookError: false,
  });
});

test('consulta 3D carrega um conjunto maior sem travar a navegação', async ({ page }) => {
  await page.goto('/tests/fixtures/viewer.html?noPdf&many');
  await page.getByRole('button', { name: '3D', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.tag-region-canvas canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Ver todas' }).click();
  await page.getByRole('button', { name: 'Centralizar TAG' }).click();
  await page.getByRole('button', { name: 'Aumentar zoom 3D' }).click();
  await page.getByRole('button', { name: 'Desenhos', exact: true }).click();
  await expect(page.locator('.tag-region-canvas canvas')).toHaveCount(0);
});
