import { test, expect } from '@playwright/test';

test('visitante pode pesquisar sem login e administração continua protegida', async ({ page }) => {
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByLabel('Pesquisar TAG')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toHaveCount(0);
  await expect(page.getByText('Login necessário')).toHaveCount(0);

  const searchRequest = page.waitForRequest((request) =>
    request.url().includes('firestore.googleapis.com'),
  );
  await page.getByLabel('Pesquisar TAG').fill('DEMO');
  await searchRequest;

  await page.getByRole('link', { name: 'Administração', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Entrar com Google' })).toBeVisible();
  await expect(
    page.getByText('Entre com e-mail e senha ou com Google para acessar.'),
  ).toBeVisible();
  await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password');
  await expect(page.getByRole('navigation', { name: 'Áreas administrativas' })).toHaveCount(0);
});
