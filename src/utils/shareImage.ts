import type { SelectedTagContext } from '../types/domain';
import type { PdfHandle } from '../features/viewer/EmbedPdfSurface';
import { realToPdfPoint } from './calibration';
import { pointInPage, pageToScreen, viewportRect } from './viewport';

export async function generateLocationImage(
  context: SelectedTagContext,
  handles: { plant: PdfHandle; side: PdfHandle },
) {
  if (!context.drawings)
    throw new Error('Configure e calibre os dois desenhos globais antes de compartilhar.');
  const width = 960,
    height = 720,
    gap = 24;
  const images = await Promise.all(
    (['plant', 'side'] as const).map(async (view) => {
      const drawing = context.drawings![view],
        handle = handles[view];
      if (drawing.calibration.model !== 'affine' || drawing.calibration.pdfId !== drawing.path)
        throw new Error('Calibração multiponto indisponível.');
      if (
        handle.pdfUrl !== (view === 'plant' ? context.plantPdfUrl : context.sidePdfUrl) ||
        handle.page.index !== drawing.pageIndex ||
        !drawing.page ||
        drawing.page.width !== handle.page.size.width ||
        drawing.page.height !== handle.page.size.height ||
        drawing.page.rotation !== handle.page.rotation
      )
        throw new Error('O PDF mudou. Reabra e confirme a calibração antes de compartilhar.');
      const point = realToPdfPoint(context.tag, view, drawing.calibration);
      if (!pointInPage(point, handle.page.size))
        throw new Error(
          `TAG fora do desenho de ${view === 'plant' ? 'Planta' : 'Lateral'}. Revise a calibração.`,
        );
      const rect = viewportRect(
        handle.page.size,
        { width, height },
        { zoom: context.drawings!.shareZoom, centerX: point.x, centerY: point.y },
      );
      return {
        blob: await handle.render(rect, width),
        point: pageToScreen(point, rect, { width, height }),
      };
    }),
  );
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não oferece suporte à geração de imagens.');
  canvas.width = width * 2 + gap * 3;
  ctx.font = '28px sans-serif';
  const lines: string[] = [];
  for (const source of [
    `TAG: ${context.tag.tag}`,
    `Descrição: ${context.tag.description}`,
    `Região: ${context.resolution.label}`,
  ]) {
    let line = '';
    // Wrap even unbroken equipment identifiers without losing text.
    for (const character of source) {
      if (ctx.measureText(line + character).width > canvas.width - gap * 2) {
        lines.push(line);
        line = '';
      }
      line += character;
    }
    lines.push(line);
  }
  const header = 110 + lines.length * 38;
  canvas.height = header + height + 70;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#008542';
  ctx.fillRect(0, 0, canvas.width, 8);
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('LocTag', gap, 64);
  ctx.font = '28px sans-serif';
  ctx.fillStyle = '#1e3026';
  lines.forEach((line, i) => ctx.fillText(line, gap, 110 + i * 38));
  for (let i = 0; i < images.length; i++) {
    const x = gap + i * (width + gap),
      y = header + 32;
    ctx.fillStyle = '#006b35';
    ctx.font = 'bold 25px sans-serif';
    ctx.fillText(i === 0 ? 'PLANTA' : 'LATERAL', x, header + 12);
    const bitmap = await createImageBitmap(images[i].blob);
    ctx.drawImage(bitmap, x, y, width, height);
    bitmap.close();
    ctx.strokeStyle = '#cfded5';
    ctx.strokeRect(x, y, width, height);
    const px = x + images[i].point.x,
      py = y + images[i].point.y;
    ctx.beginPath();
    ctx.arc(px, py, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fdc82f99';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#008542';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'white';
    ctx.stroke();
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 5;
    const textWidth = Math.min(ctx.measureText(context.tag.tag).width, width - 24);
    const tx = Math.max(x + textWidth / 2 + 12, Math.min(x + width - textWidth / 2 - 12, px)),
      ty = py - y < 40 ? py + 40 : py - 28;
    ctx.strokeText(context.tag.tag, tx, ty, width - 24);
    ctx.fillStyle = '#006b35';
    ctx.fillText(context.tag.tag, tx, ty, width - 24);
    ctx.textAlign = 'left';
  }
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível gerar o PNG.'))),
      'image/png',
    ),
  );
}
