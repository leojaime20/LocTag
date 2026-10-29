import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`splash abre e libera a página em ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');

    const splash = page.getByRole('status', { name: 'Carregando LocTag' });
    const image = splash.getByRole('img', { name: 'LocTag' });
    await expect(splash).toBeVisible();
    await expect(image).toHaveJSProperty('complete', true);
    await expect(image).toHaveCSS('object-fit', 'contain');
    const box = await image.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(400);
    expect(box!.height).toBeLessThanOrEqual(300);
    expect(box!.x).toBeGreaterThan(0);
    expect(box!.x + box!.width).toBeLessThan(viewport.width);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', viewport.width);

    await expect(splash).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Escolha um projeto' })).toBeVisible();
  });
}
