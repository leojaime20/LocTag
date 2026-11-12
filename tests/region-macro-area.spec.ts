import { expect, test } from '@playwright/test';

test('cadastro normaliza e permite remover a macroárea da região', async ({ page }) => {
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await page.route('**/src/services/api/drawings.ts', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      /(["'])[^"']*firebase_firestore[^"']*\1/,
      '"/tests/fixtures/region-firestore.ts"',
    );
    expect(body).toContain('"/tests/fixtures/region-firestore.ts"');
    await route.fulfill({ response, body });
  });
  await page.goto('/tests/fixtures/admin.html');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const macroArea = page.getByLabel('Macroárea (cor do 3D)');
  await expect(macroArea).toHaveValue('Área inicial');
  await macroArea.fill('  Área   de Utilidades  ');
  await page.getByRole('button', { name: 'Salvar região' }).click();
  await expect(page.getByRole('status')).toHaveText('Região salva.');
  const saved = await page.evaluate(async () => {
    const { documents } = await import('/tests/fixtures/region-firestore.ts');
    return documents.get('regions/a')?.macroArea;
  });
  expect(saved).toBe('Área de Utilidades');

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await macroArea.fill('');
  await page.getByRole('button', { name: 'Salvar região' }).click();
  await expect(page.getByRole('status')).toHaveText('Região salva.');
  const cleared = await page.evaluate(async () => {
    const { documents } = await import('/tests/fixtures/region-firestore.ts');
    return documents.get('regions/a')?.macroArea;
  });
  expect(cleared).toBe('');
});
