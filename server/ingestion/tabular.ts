import { z } from 'zod';
import { isSafeResourceUrl, curriculumFields, type ColumnMapping, type CurriculumProposal, type GridPreview, type CurriculumNode } from '../../shared/contracts/resources';
import { AppError } from '../ports';

export interface SourceCell { text: string; url?: string }
export interface SourceSheet { name: string; hidden: boolean; rows: Map<number, Map<string, SourceCell>> }
export interface TabularSource { sheets: SourceSheet[] }
/** Future PDF/DOCX/XLSX/Drive/URL adapters must return cited assertions, never invented fields. */
export interface CurriculumAdapter<Source, Mapping> { id: string; extract(source: Source, mapping: Mapping): CurriculumProposal }
export function columnName(index: number): string {
  let value = ''; for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) value = String.fromCharCode(65 + (n - 1) % 26) + value;
  return value;
}
function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false, closed = false;
  const push = () => { row.push(cell); cell = ''; closed = false; if (row.length > 200) throw new AppError(400, 'Use at most 200 columns.'); };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i+1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === '"') { if (cell || closed) throw new AppError(400, 'Malformed CSV quotation.'); quoted = true; }
    else if (c === ',') push();
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i+1] === '\n') i++; push(); rows.push(row); row = []; }
    else { if (closed) throw new AppError(400, 'Unexpected text after a CSV quote.'); cell += c; }
    if (cell.length > 12000 || rows.length > 10000) throw new AppError(400, 'This table exceeds the supported row or cell size.');
  }
  if (quoted) throw new AppError(400, 'Unclosed CSV quotation.');
  if (cell || row.length || closed) { push(); rows.push(row); }
  return rows;
}
const snapshotSchema = z.object({
  spreadsheetUrl: z.string().optional(),
  sheets: z.array(z.object({
    properties: z.object({ title: z.string().min(1).max(120), sheetId: z.number().int().nonnegative().optional(), hidden: z.boolean().optional() }),
    data: z.array(z.object({ startRow: z.number().int().min(0).max(9999).optional(), startColumn: z.number().int().min(0).max(199).optional(),
      rowData: z.array(z.object({ values: z.array(z.object({ formattedValue: z.string().max(12000).optional(), hyperlink: z.string().optional() })).max(200).optional() })).max(10000).optional(),
    })).max(100).optional(),
  })).min(1).max(50),
});

/** Same formatted cell text + A1 locations used by the legacy offline importer. No formulas execute. */
export function readTabular(bytes: Uint8Array, fileName: string): TabularSource {
  let raw: string;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new AppError(400, 'Save the table as UTF-8 CSV or spreadsheet JSON.'); }
  if (raw.includes('\0')) throw new AppError(400, 'Binary files are not supported by this importer.');
  raw = raw.replace(/^\uFEFF/, '');
  if (/\.csv$/i.test(fileName)) {
    const rows = new Map<number, Map<string, SourceCell>>();
    const parsed = csvRows(raw);
    if (parsed.reduce((count, row) => count + row.length, 0) > 100000) throw new AppError(400, 'The table exceeds the supported cell limit.');
    parsed.forEach((values, index) => rows.set(index + 1, new Map(values.map((text, col) => [columnName(col), { text }]))));
    if (!rows.size) throw new AppError(400, 'The CSV is empty.');
    return { sheets: [{ name: 'CSV', hidden: false, rows }] };
  }
  if (!/\.json$/i.test(fileName)) throw new AppError(415, 'Only CSV and spreadsheet JSON extraction are supported.');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new AppError(400, 'Invalid spreadsheet JSON.'); }
  const checked = snapshotSchema.safeParse(parsed);
  if (!checked.success) throw new AppError(400, 'Use a spreadsheet cell snapshot with sheets, properties, and formatted rowData. Other JSON formats are not supported.');
  const names = new Set<string>(); let count = 0;
  const sheets = checked.data.sheets.map(sheet => {
    if (names.has(sheet.properties.title)) throw new AppError(400, 'Sheet names must be unique.');
    names.add(sheet.properties.title);
    const rows = new Map<number, Map<string, SourceCell>>();
    for (const range of sheet.data ?? []) for (const [offset, row] of (range.rowData ?? []).entries()) {
      const rowNumber = (range.startRow ?? 0) + offset + 1;
      if (rowNumber > 10000) throw new AppError(400, 'Use at most 10,000 rows.');
      const cells = rows.get(rowNumber) ?? new Map<string, SourceCell>(); rows.set(rowNumber, cells);
      for (const [index, value] of (row.values ?? []).entries()) {
        if (++count > 100000 || (range.startColumn ?? 0) + index >= 200) throw new AppError(400, 'The snapshot exceeds the supported cell limit.');
        const column = columnName((range.startColumn ?? 0) + index);
        if (cells.has(column)) throw new AppError(400, 'Overlapping spreadsheet ranges must be resolved before upload.');
        cells.set(column, { text: value.formattedValue ?? '', ...(value.hyperlink && isSafeResourceUrl(value.hyperlink) ? { url: value.hyperlink } : {}) });
      }
    }
    return { name: sheet.properties.title, hidden: !!sheet.properties.hidden, rows };
  });
  return { sheets };
}
export function preview(source: TabularSource): GridPreview {
  return { sheets: source.sheets.map(sheet => ({ name: sheet.name, hidden: sheet.hidden, rowCount: Math.max(0, ...sheet.rows.keys()),
    columns: [...new Set([...sheet.rows.values()].flatMap(row => [...row.keys()]))],
    sample: [...sheet.rows.entries()].filter(([, cells]) => [...cells.values()].some(c => c.text.trim())).slice(0, 12).map(([row, cells]) => ({ row, cells: Object.fromEntries([...cells].filter(([, cell]) => cell.text.trim()).map(([col, cell]) => [col, cell.text.slice(0, 180)])) })),
  })) };
}
function explicitWindow(text: string) {
  const dates = text.trim().split(/\s*(?:to|–)\s*/);
  return dates.length <= 2 && dates.every(d => z.iso.date().safeParse(d).success) && (dates.length === 1 || dates[0] <= dates[1]);
}
export const tabularAdapter: CurriculumAdapter<TabularSource, ColumnMapping> = {
  id: 'tabular-v1',
  extract(source, mapping) {
    const sheet = source.sheets.find(s => s.name === mapping.sheet);
    if (!sheet) throw new AppError(400, 'Choose a sheet in this source.');
    if (mapping.lastRow > Math.max(0, ...sheet.rows.keys())) throw new AppError(400, 'The selected rows extend beyond the source.');
    const nodes: CurriculumNode[] = [];
    const conflicts: CurriculumProposal['conflicts'] = [];
    for (let row = mapping.firstRow; row <= mapping.lastRow; row++) {
      const assertions = mapping.columns.flatMap(({ field, column }) => {
        const cell = sheet.rows.get(row)?.get(column);
        if (!cell?.text.trim()) return [];
        const uncertainty: string[] = [];
        if (field === 'window' && !explicitWindow(cell.text)) uncertainty.push('Timing is preserved literally; year, dates, or duration may need clarification. No date has been inferred.');
        if (field === 'standards') uncertainty.push('A reference in this source is not verified alignment or official standard wording.');
        if (sheet.hidden) uncertainty.push('This sheet was hidden in the source snapshot. Confirm its applicability.');
        return [{ id: `${row}-${column}`, field, text: cell.text, citation: { sheet: sheet.name, row, cell: `${column}${row}`, quote: cell.text, ...(cell.url ? { url: cell.url } : {}) }, provenance: 'extracted' as const, confidence: 'literal' as const, uncertainty }];
      });
      if (!assertions.length) continue;
      if (assertions.length + nodes.reduce((n, node) => n + node.assertions.length, 0) > 1500) throw new AppError(400, 'Select fewer cells; a review supports at most 1,500 assertions.');
      for (const field of curriculumFields) {
        const repeated = assertions.filter(a => a.field === field);
        if (repeated.length > 1 && new Set(repeated.map(a => a.text)).size > 1) conflicts.push({ id: `${row}-${field}`, message: `Row ${row} has differing values mapped to ${field}. Preserve or exclude them explicitly; no source was chosen automatically.`, assertionIds: repeated.map(a => a.id) });
      }
      nodes.push({ id: `row-${row}`, row, assertions });
    }
    if (!nodes.length) throw new AppError(400, 'No text was found in the selected cells.');
    return { adapter: 'tabular-v1', nodes, conflicts, missing: curriculumFields.filter(field => !nodes.some(n => n.assertions.some(a => a.field === field))),
      warnings: ['Only the selected cells were extracted. Empty cells stay empty; dates and sequence are never carried forward.', 'Column meanings and authority purposes are teacher declarations. Review each assertion against the original.', 'Cross-document conflicts and semantic contradictions are not automatically detected in this increment. Record any known conflicts in your review note.'] };
  },
};
