import { test, expect } from '@playwright/test';
test('PDF real: zoom, arraste, minimapa, troca de TAG sem nova carga e PNG', async ({ page }) => {
  let loads = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/drawing.pdf')) loads++;
  });
  await page.goto('/tests/fixtures/viewer.html');
  await expect(page.locator('.pdf-layer[alt="Desenho técnico"]')).toHaveCount(2, {
    timeout: 45000,
  });
  const initialLoads = loads;
  await page.getByRole('button', { name: 'Aumentar zoom' }).first().click();
  await expect(page.getByTestId('camera')).toContainText('4.199');
  await page.getByRole('button', { name: 'Desenho completo' }).first().click();
  await page.getByRole('button', { name: 'Centralizar TAG' }).first().click();
  const viewport = page.locator('.pdf-viewport').first(),
    box = (await viewport.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page
    .locator('.minimap svg')
    .first()
    .click({ position: { x: 110, y: 50 } });
  await page.getByRole('button', { name: 'Alternar TAG' }).click();
  await expect(page.locator('.pdf-overlay').first()).toContainText('P-202');
  expect(loads).toBe(initialLoads);
  await page.getByRole('button', { name: 'Compartilhar', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Baixar PNG' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('LocTag-P-202.png');
  await page.screenshot({ path: 'test-results/viewer-share.png' });
});
test('cliques de calibração usam coordenadas PDF, inclusive páginas rotacionadas e CropBox', async ({
  page,
}) => {
  for (let index = 0; index < 5; index++) {
    await page.goto(`/tests/fixtures/viewer.html?picker&page=${index}`);
    await expect(page.locator('.pdf-layer[alt="Desenho técnico"]')).toHaveCount(1, {
      timeout: 45000,
    });
    const landmarks = [
      [200, 200, 800, 600],
      [400, 200, 600, 800],
      [600, 400, 800, 600],
      [200, 600, 600, 800],
      [100, 100, 600, 400],
    ];
    const pixel = await page.locator('.pdf-layer[alt=""]').evaluate(async (node, landmark) => {
      const image = node as HTMLImageElement;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return Array.from(
        ctx.getImageData(
          Math.round((landmark[0] * canvas.width) / landmark[2]),
          Math.round((landmark[1] * canvas.height) / landmark[3]),
          1,
          1,
        ).data,
      );
    }, landmarks[index]);
    expect(pixel[0]).toBeGreaterThan(200);
    expect(pixel[1]).toBeLessThan(60);
    expect(pixel[2]).toBeLessThan(60);
    const viewport = page.locator('.pdf-viewport'),
      box = (await viewport.boundingBox())!;
    await viewport.click({ position: { x: box.width / 2, y: box.height / 2 } });
    const point = JSON.parse((await page.getByTestId('picked').textContent())!);
    const expected =
      index === 4 ? { x: 300, y: 200 } : index % 2 ? { x: 300, y: 400 } : { x: 400, y: 300 };
    expect(point.x).toBeCloseTo(expected.x, 0);
    expect(point.y).toBeCloseTo(expected.y, 0);
  }
});

test('celular mantém os PDFs nas abas e adapta o minimapa ao redimensionamento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let loads = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/drawing.pdf')) loads++;
  });
  await page.goto('/tests/fixtures/viewer.html');
  await expect(page.locator('.pdf-layer[alt="Desenho técnico"]')).toHaveCount(2);
  const initial = loads;
  await page.getByRole('button', { name: 'Lateral', exact: true }).click();
  await expect(page.locator('.viewer-panel').nth(1)).toBeVisible();
  await page.getByRole('button', { name: 'Planta', exact: true }).click();
  await page.getByRole('button', { name: 'Recolher minimapa' }).first().click();
  await expect(page.locator('.minimap svg').first()).not.toBeVisible();
  await page.getByRole('button', { name: 'Minimapa', exact: true }).first().click();
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(page.locator('.viewer-panel').nth(1)).toBeVisible();
  await page.getByRole('button', { name: 'Tela cheia' }).first().click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  expect(loads).toBe(initial);
});
