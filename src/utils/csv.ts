import type { EquipmentTag, TagStatus } from '../types/domain';

export interface CsvParseResult {
  rows: Record<string, string>[];
  errors: string[];
}

const requiredColumns = [
  'tag',
  'description',
  'regionId',
  'x',
  'y',
  'z',
  'type',
  'status',
] as const;
const supportedDelimiters = [',', ';', '\t'] as const;

function parseLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function countDelimiter(line: string, delimiter: string) {
  return parseLine(line, delimiter).length - 1;
}

function detectDelimiter(headerLine: string) {
  return supportedDelimiters.reduce(
    (best, delimiter) =>
      countDelimiter(headerLine, delimiter) > countDelimiter(headerLine, best) ? delimiter : best,
    ',',
  );
}

export function parseCsv(text: string): CsvParseResult {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
  if (!normalized) return { rows: [], errors: ['O arquivo CSV está vazio.'] };

  const [headerLine, ...lines] = normalized.split('\n').filter((line) => line.trim().length > 0);
  const delimiter = detectDelimiter(headerLine);
  const headers = parseLine(headerLine, delimiter).map((header) => header.trim());
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [`Colunas obrigatórias ausentes: ${missingColumns.join(', ')}.`],
    };
  }

  const rows = lines.map((line) => {
    const cells = parseLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });

  return { rows, errors: [] };
}

function toNumber(value: string, rowIndex: number, column: string, errors: string[]) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    errors.push(`Linha ${rowIndex}: campo ${column} deve ser numérico.`);
    return 0;
  }
  return parsed;
}

function normalizeStatus(value: string): TagStatus {
  if (value === 'active' || value === 'inactive' || value === 'unknown') return value;
  return 'unknown';
}

export function validateTagRows(rows: Record<string, string>[]) {
  const errors: string[] = [];
  const seenTags = new Set<string>();

  const tags = rows.map((row, index): EquipmentTag => {
    const rowNumber = index + 2;
    const tag = row.tag?.trim();
    const description = row.description?.trim();
    const regionId = row.regionId?.trim();

    if (!tag) errors.push(`Linha ${rowNumber}: tag é obrigatória.`);
    if (!description) errors.push(`Linha ${rowNumber}: description é obrigatório.`);
    if (!regionId) errors.push(`Linha ${rowNumber}: regionId é obrigatório.`);
    if (tag && seenTags.has(tag)) errors.push(`Linha ${rowNumber}: tag duplicada (${tag}).`);
    if (tag) seenTags.add(tag);

    return {
      id: row.id?.trim() || tag || `linha-${rowNumber}`,
      tag: tag || '',
      description: description || '',
      regionId: regionId || '',
      x: toNumber(row.x, rowNumber, 'x', errors),
      y: toNumber(row.y, rowNumber, 'y', errors),
      z: toNumber(row.z, rowNumber, 'z', errors),
      type: row.type?.trim() || 'Equipamento',
      status: normalizeStatus(row.status?.trim() ?? 'unknown'),
    };
  });

  return { tags, errors };
}

function escapeCsv(value: string | number) {
  const stringValue = String(value);
  if (!/[",\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function tagsToCsv(tags: EquipmentTag[]) {
  const headers = ['id', ...requiredColumns];
  const lines = tags.map((tag) =>
    [tag.id, tag.tag, tag.description, tag.regionId, tag.x, tag.y, tag.z, tag.type, tag.status]
      .map(escapeCsv)
      .join(','),
  );

  return [headers.join(','), ...lines].join('\n');
}

export function downloadTextFile(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
