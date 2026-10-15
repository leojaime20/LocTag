import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { writeFileSync } from 'node:fs';
// Four identical CAD-like pages with native PDF rotations; fifth has an offset CropBox.
const content =
  'q\n1 1 1 rg 0 0 800 600 re f\n0.8 0.85 0.8 RG 1 w\n' +
  Array.from({ length: 17 }, (_, i) => `${i * 50} 0 m ${i * 50} 600 l S`).join('\n') +
  '\n' +
  Array.from({ length: 13 }, (_, i) => `0 ${i * 50} m 800 ${i * 50} l S`).join('\n') +
  '\n1 0 0 rg 180 380 40 40 re f\n0 0 1 rg 580 180 40 40 re f\n0 0 0 rg BT /F1 24 Tf 210 450 Td (P-101A - Reference) Tj ET\nQ\n';
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R 9 0 R] /Count 5 >>',
  ...[0, 90, 180, 270].map(
    (rotation) =>
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 600] /Rotate ${rotation} /Resources << /Font << /F1 7 0 R >> >> /Contents 8 0 R >>`,
  ),
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 600] /CropBox [100 100 700 500] /Resources << /Font << /F1 7 0 R >> >> /Contents 8 0 R >>',
];
let pdf = '%PDF-1.7\n';
const offsets = [0];
objects.forEach((object, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf +=
  `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
  offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('') +
  `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(new URL('./drawing.pdf', import.meta.url), pdf);
