import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
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
});

test('exclusão exige confirmação, remove o cadastro e limpa a edição', async ({ page }) => {
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByRole('button', { name: 'Excluir definitivamente', exact: true }).click();
  await expect(page.getByText(/sem possibilidade de restauração/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const stateBefore = await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    const { documents, writes } = await import(path);
    return { exists: documents.has('regions/a'), writes };
  });
  expect(stateBefore).toEqual({ exists: true, writes: [] });
  await page.getByRole('button', { name: 'Excluir definitivamente', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão definitiva' }).click();
  await expect(page.getByRole('status')).toHaveText('Região excluída definitivamente.');
  await expect(page.getByText('Deck A', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('ID da região')).toBeEnabled();
  await expect(page.getByLabel('ID da região')).toHaveValue('');
  const stateAfter = await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    const { documents, writes } = await import(path);
    return { exists: documents.has('regions/a'), tag: documents.get('tags/pump'), writes };
  });
  expect(stateAfter).toEqual({
    exists: false,
    tag: { regionId: 'a' },
    writes: ['delete:regions/a'],
  });
});

test('região arquivada também pode ser excluída definitivamente', async ({ page }) => {
  await page.getByRole('button', { name: 'Arquivar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar arquivamento' }).click();
  await expect(page.getByText('a • arquivada', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restaurar / editar' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir definitivamente', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão definitiva' }).click();
  await expect(page.getByText('Deck A', { exact: true })).toHaveCount(0);
  const writes = await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    return (await import(path)).writes;
  });
  expect(writes).toEqual(['update:regions/a', 'delete:regions/a']);
});

test('erros preservam a região e permitem tentar novamente', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    (await import(path)).failWith('Sem permissão para excluir.');
  });
  await page.getByRole('button', { name: 'Excluir definitivamente', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão definitiva' }).click();
  await expect(page.getByRole('alert')).toHaveText('Sem permissão para excluir.');
  await expect(page.getByText('Deck A', { exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    (await import(path)).failWith('');
  });
  await page.getByRole('button', { name: 'Confirmar exclusão definitiva' }).click();
  await expect(page.getByRole('status')).toHaveText('Região excluída definitivamente.');
});

test('não exclui a região usada nos desenhos ilustrativos', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    (await import(path)).documents.set('settings/globalDrawings', { exampleRegionId: 'a' });
  });
  await page.getByRole('button', { name: 'Excluir definitivamente', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar exclusão definitiva' }).click();
  await expect(page.getByRole('alert')).toContainText('Altere a região em Desenhos globais');
  await expect(page.getByText('Deck A', { exact: true })).toBeVisible();
  const writes = await page.evaluate(async () => {
    const path = '/tests/fixtures/region-firestore.ts';
    return (await import(path)).writes;
  });
  expect(writes).toEqual([]);
});
