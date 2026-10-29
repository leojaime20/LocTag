import { expect, test } from '@playwright/test';

test('P84 mantém caminhos existentes e outro projeto usa espaço próprio', async ({ page }) => {
  await page.goto('/');
  const paths = await page.evaluate(async () => {
    const api = await import('/src/services/api/projects.ts');
    return {
      p84: {
        tags: api.projectCollection('p84', 'tags').path,
        settings: api.projectDoc('p84', 'settings', 'globalDrawings').path,
        pdf: api.projectPdfPath('p84', 'planta.pdf'),
      },
      p85: {
        tags: api.projectCollection('p85', 'tags').path,
        settings: api.projectDoc('p85', 'settings', 'globalDrawings').path,
        pdf: api.projectPdfPath('p85', 'planta.pdf'),
      },
    };
  });
  expect(paths).toEqual({
    p84: { tags: 'tags', settings: 'settings/globalDrawings', pdf: 'pdfs/planta.pdf' },
    p85: {
      tags: 'projects/p85/tags',
      settings: 'projects/p85/settings/globalDrawings',
      pdf: 'projects/p85/pdfs/planta.pdf',
    },
  });
});
