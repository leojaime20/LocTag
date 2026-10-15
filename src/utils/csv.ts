import type { EquipmentTag, TagStatus } from '../types/domain';

export interface CsvParseResult {
  rows: Record<string, string>[];
  errors: string[];
  lineNumbers: number[];
  invalidCount: number;
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
  const normalized = text.replace(/^\uFEFF/, '');
  if (!normalized.trim())
    return { rows: [], errors: ['O arquivo CSV está vazio.'], lineNumbers: [], invalidCount: 0 };
  const delimiter = detectDelimiter(normalized.split(/\r?\n/)[0]);
  const records: { cells: string[]; line: number; invalid: boolean }[] = [];
  const errors: string[] = [];
  let cells: string[] = [],
    value = '',
    quoted = false,
    closed = false,
    line = 1,
    startLine = 1,
    invalid = false;
  const pushCell = () => {
    cells.push(value);
    value = '';
    closed = false;
  };
  const pushRecord = () => {
    pushCell();
    if (cells.some((v) => v.trim()) || cells.length > 1)
      records.push({ cells, line: startLine, invalid });
    cells = [];
    invalid = false;
    startLine = line + 1;
  };
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized[i];
    if (quoted) {
      if (c === '"' && normalized[i + 1] === '"') {
        value += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else {
        value += c;
        if (c === '\n') line++;
      }
    } else if (c === delimiter) {
      pushCell();
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && normalized[i + 1] === '\n') i++;
      pushRecord();
      line++;
      startLine = line;
    } else if (c === '"' && value === '' && !closed) {
      quoted = true;
    } else if (c === '"' || (closed && c.trim())) {
      invalid = true;
      value += c;
    } else if (!closed) value += c;
  }
  if (quoted) {
    invalid = true;
    errors.push(`Linha ${startLine}: aspas não fechadas.`);
  }
  if (value || cells.length || closed || quoted) pushRecord();
  const header = records.shift();
  if (!header)
    return { rows: [], errors: ['Cabeçalho ausente.'], lineNumbers: [], invalidCount: 0 };
  const headers = header.cells.map((h) =>
    h.trim() === 'descricao' ? 'description' : h.trim() === 'sistema' ? 'type' : h.trim(),
  );
  const missing = requiredColumns.filter((c) => !headers.includes(c));
  if (missing.length) errors.push(`Colunas obrigatórias ausentes: ${missing.join(', ')}.`);
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    errors.push('Cabeçalhos vazios ou duplicados.');
  if (header.invalid) errors.push('Cabeçalho CSV malformado.');
  const rows: Record<string, string>[] = [];
  const lineNumbers: number[] = [];
  let invalidCount = 0;
  for (const record of records) {
    if (record.invalid || record.cells.length !== headers.length) {
      invalidCount++;
      errors.push(
        `Linha ${record.line}: ${record.invalid ? 'aspas inválidas' : 'quantidade de colunas diferente do cabeçalho'}.`,
      );
      continue;
    }
    rows.push(Object.fromEntries(headers.map((h, i) => [h, record.cells[i]])));
    lineNumbers.push(record.line);
  }
  if (!records.length) errors.push('O CSV não contém registros.');
  return { rows, errors, lineNumbers, invalidCount };
}

function toNumber(value: string, rowIndex: number, column: string, errors: string[]) {
  const parsed = Number(value);
  if (value == null || value.trim() === '' || !Number.isFinite(parsed)) {
    errors.push(`Linha ${rowIndex}: campo ${column} deve ser numérico e preenchido.`);
    return NaN;
  }
  return parsed;
}

export function validateTagRows(rows: Record<string, string>[], lineNumbers?: number[]) {
  const errors: string[] = [];
  const seenTags = new Set<string>(),
    seenIds = new Set<string>();
  let invalidCount = 0;
  const tags: EquipmentTag[] = [];
  rows.forEach((row, index) => {
    const rowNumber = lineNumbers?.[index] ?? index + 2,
      before = errors.length;
    const tag = row.tag?.trim() ?? '',
      description = row.description ?? '';
    const id = row.id?.trim() || encodeURIComponent(tag);
    if (!tag) errors.push(`Linha ${rowNumber}: tag é obrigatória.`);
    if (!description.trim()) errors.push(`Linha ${rowNumber}: description é obrigatório.`);
    if (seenTags.has(tag)) errors.push(`Linha ${rowNumber}: tag duplicada (${tag}).`);
    if (seenIds.has(id)) errors.push(`Linha ${rowNumber}: ID duplicado (${id}).`);
    if (id.includes('/') || id === '.' || id === '..' || new TextEncoder().encode(id).length > 1500)
      errors.push(`Linha ${rowNumber}: ID inválido para o Firestore.`);
    seenTags.add(tag);
    seenIds.add(id);
    const status = row.status?.trim();
    if (!['active', 'inactive', 'unknown'].includes(status))
      errors.push(`Linha ${rowNumber}: status deve ser active, inactive ou unknown.`);
    const result: EquipmentTag = {
      id,
      tag,
      description,
      regionId: row.regionId?.trim() ?? '',
      moduleRegion: row.moduleRegion?.trim(),
      owner: row.owner?.trim(),
      elevation: row.elevation?.trim(),
      x: toNumber(row.x, rowNumber, 'x', errors),
      y: toNumber(row.y, rowNumber, 'y', errors),
      z: toNumber(row.z, rowNumber, 'z', errors),
      type: row.type ?? '',
      status: status as TagStatus,
    };
    if (errors.length > before) invalidCount++;
    else tags.push(result);
  });
  return { tags, errors, invalidCount };
}

function escapeCsv(value: string | number) {
  const stringValue = String(value);
  if (!/[",;\t\r\n]/.test(stringValue)) return stringValue;
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export function tagsToCsv(tags: EquipmentTag[]) {
  const headers = [
    'id',
    'tag',
    'description',
    'regionId',
    'moduleRegion',
    'owner',
    'elevation',
    'x',
    'y',
    'z',
    'type',
    'status',
  ];
  const lines = tags.map((tag) =>
    [
      tag.id,
      tag.tag,
      tag.description,
      tag.regionId,
      tag.moduleRegion ?? '',
      tag.owner ?? '',
      tag.elevation ?? '',
      tag.x,
      tag.y,
      tag.z,
      tag.type,
      tag.status,
    ]
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
