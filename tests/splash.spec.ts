import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1280, height: 800, fit: 'cover' },
  { width: 390, height: 844, fit: 'contain' },
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
    await expect(image).toHaveCSS('object-fit', viewport.fit);
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', viewport.width);

    await expect(splash).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Escolha um projeto' })).toBeVisible();
  });
}
