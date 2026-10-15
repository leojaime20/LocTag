import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await page.route('**/firestore.googleapis.com/**', (route) => route.abort());
});
test('regiões exigem limites completos e reconhecimento de conflitos', async ({ page }) => {
  await page.goto('/tests/fixtures/admin.html');
  await page.getByLabel('ID da região').fill('novo');
  await page.getByLabel('Nome da região').fill('Deck B');
  await expect(page.getByRole('button', { name: 'Criar região', exact: true })).toBeDisabled();
  for (const axis of ['X', 'Y', 'Z']) {
    await page.getByLabel(`${axis} mínimo (m)`).fill('5');
    await page.getByLabel(`${axis} máximo (m)`).fill('15');
  }
  await expect(page.getByText('Deck A: Sobreposição parcial')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Criar região', exact: true })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button', { name: 'Criar região', exact: true })).toBeEnabled();
  await page.getByLabel('X mínimo (m)').fill('10');
  await expect(page.getByText(/Deck A: Contato de fronteira/)).toBeVisible();
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Criar região', exact: true })).toBeDisabled();
});
test('CSV apresenta registros e erros e não escreve antes da confirmação', async ({ page }) => {
  let firestoreRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('firestore.googleapis.com')) firestoreRequests++;
  });
  await page.goto('/tests/fixtures/admin.html?mode=csv');
  const header = 'tag,description,regionId,x,y,z,type,status\n';
  await page.locator('input[type=file]').setInputFiles({
    name: 'tags.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      header + 'P1,"Bomba, água",,5,5,5,Bomba,active\nP2,Bomba,,0,,0,Bomba,invalid',
    ),
  });
  await expect(page.getByText(/1 registros válidos • 1 inválidos/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar e substituir tabela' })).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({
    name: 'tags.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(header + 'P1,"Bomba, água",,5,5,5,Bomba,active'),
  });
  await expect(page.getByRole('button', { name: 'Confirmar e substituir tabela' })).toBeEnabled();
  await expect(page.getByRole('cell', { name: 'Bomba, água', exact: true })).toBeVisible();
  expect(firestoreRequests).toBe(0);
});
test('calibração adiciona, edita e exclui pontos e apresenta erros antes de salvar', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/admin.html?mode=calibration');
  await expect(page.locator('.pdf-layer[alt="Desenho técnico"]')).toHaveCount(2);
  const editor = page
    .locator('section.panel')
    .filter({ has: page.getByRole('heading', { name: 'Planta • X/Y', exact: true }) });
  const viewport = editor.locator('.pdf-viewport');
  const bounds = (await viewport.boundingBox())!;
  for (const [i, position] of [
    { x: 0.3, y: 0.4 },
    { x: 0.6, y: 0.4 },
    { x: 0.3, y: 0.6 },
  ].entries()) {
    await editor.getByRole('button', { name: 'Adicionar ponto por clique' }).click();
    await viewport.click({
      position: { x: bounds.width * position.x, y: bounds.height * position.y },
    });
    await editor.getByLabel(`P${i + 1} X (m)`, { exact: true }).fill(String(i === 1 ? 100 : 0));
    await editor.getByLabel(`P${i + 1} Y (m)`, { exact: true }).fill(String(i === 2 ? 100 : 0));
  }
  await expect(editor.getByText(/Prévia: erro médio/)).toBeVisible();
  await editor.getByRole('button', { name: 'Excluir ponto P3' }).click();
  await expect(editor.getByText('Cadastre ao menos três pontos não colineares.')).toBeVisible();
});
