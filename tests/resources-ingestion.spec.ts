import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readTabular, preview, tabularAdapter } from '../server/ingestion/tabular';
import { activeBinding, isSafeResourceUrl, mappingInput, originalInput, type CurriculumBinding } from '../shared/contracts/resources';
import curriculum from '../src/data/curriculum.json' with { type: 'json' };

const bytes = (value: string) => new TextEncoder().encode(value);
test('CSV ingestion preserves quoted cells, multiline text and blank fields without invented content', () => {
  const source = readTabular(bytes('Unit,Topic,Window\r\n"A, B","A ""quoted"" topic\ncontinued",\r\nC,Second,September 7\r\n'), 'guide.csv');
  const proposal = tabularAdapter.extract(source, { sheet: 'CSV', firstRow: 2, lastRow: 3, columns: [{ field: 'unit', column: 'A' },{ field: 'topic', column: 'B' },{ field: 'window', column: 'C' }] });
  expect(proposal.nodes[0].assertions.map(a => a.text)).toEqual(['A, B','A "quoted" topic\ncontinued']);
  expect(proposal.nodes[1].assertions[2].uncertainty).toHaveLength(1);
  expect(proposal.nodes[0].assertions[1].citation).toEqual({ sheet: 'CSV', row: 2, cell: 'B2', quote: 'A "quoted" topic\ncontinued' });
  expect(proposal.missing).toContain('objectives');
  expect(proposal.nodes.every(n => n.assertions.every(a => a.provenance === 'extracted'))).toBe(true);
  const invalidDate = tabularAdapter.extract(readTabular(bytes('Window\n2026-99-99\n2026-09-10 to 2026-09-01'), 'dates.csv'), { sheet:'CSV',firstRow:2,lastRow:3,columns:[{field:'window',column:'A'}] });
  expect(invalidDate.nodes.every(n => n.assertions[0].uncertainty.length > 0)).toBe(true);
});

test('The actual DCSS workbook reproduces literal pacing citations and keeps the known K math conflict visible', () => {
  const source = readTabular(readFileSync('content/sources/pacing-guide-cells.json'), 'pacing-guide-cells.json');
  expect(preview(source).sheets.some(s => s.hidden)).toBe(true);
  const proposal = tabularAdapter.extract(source, { sheet: 'KINDER', firstRow: 17, lastRow: 17, columns: [{ field: 'window', column: 'C' },{ field: 'standards', column: 'P' }] });
  const old = curriculum.find(c => c.sourceSheet === 'KINDER' && c.subject === 'Math' && c.sourceRow === 17)!;
  expect(proposal.nodes[0].assertions[1].text).toBe(old.sourceCells[0].text);
  expect(proposal.nodes[0].assertions[1].citation.cell).toBe('P17');
  expect(proposal.nodes[0].assertions[1].uncertainty.join(' ')).toContain('not verified');
  expect(proposal.nodes[0].assertions[0].text).toBe(old.sourceDateText);
  expect(proposal.nodes[0].assertions[0].uncertainty.join(' ')).toContain('No date has been inferred');
});

test('The isolated legacy DCSS adapter preserves every checked-in record timing and source cell', () => {
  const result = execFileSync('python3', ['-B','-c', `import json,sys
sys.path.insert(0,'scripts')
from source_adapters.dcss_fy27 import extract_pacing
source=json.load(open('content/sources/pacing-guide-cells.json'))
old=json.load(open('src/data/curriculum.json'))
new,issues,tabs=extract_pacing(source)
fields=['id','grade','subject','weekOf','instructionalWeek','quarter','source','sourceUrl','sourceSheet','sourceRow','sourceDateText','sourceCells','standardReferences','unitReferences','sessionReferences']
assert len(new)==len(old)
for a,b in zip(new,old):
 for field in fields: assert a[field]==b[field], (a['id'],field)
assert len(issues)==18
print(len(new))`], { encoding: 'utf8' });
  expect(Number(result.trim())).toBe(755);
});

test('Conflicting mapped values and hidden-source uncertainty survive extraction', () => {
  const source = readTabular(bytes(JSON.stringify({ sheets: [{ properties: { title: 'Hidden', hidden: true }, data: [{ startRow: 9, startColumn: 1, rowData: [{ values: [{ formattedValue: 'Week 1' }, { formattedValue: 'Week 3' }] }] }] }] })), 'source.json');
  const proposal = tabularAdapter.extract(source, { sheet: 'Hidden', firstRow: 10, lastRow: 10, columns: [{ field: 'window', column: 'B' },{ field: 'window', column: 'C' }] });
  expect(proposal.conflicts).toHaveLength(1); expect(proposal.conflicts[0].assertionIds).toEqual(['10-B','10-C']);
  expect(proposal.nodes[0].assertions[0].uncertainty.join(' ')).toContain('hidden');
});

test('Malformed, unsupported, oversized cells and ambiguous mappings fail before storage', () => {
  for (const [text,name] of [['"unclosed','x.csv'],['"closed"junk','x.csv'],['a\0b','x.csv'],['{"sheets":[]}','x.json'],['[]','x.json'],['bad','x.xlsx'],['x'.repeat(12001),'x.csv']]) expect(() => readTabular(bytes(text),name)).toThrow();
  expect(originalInput.safeParse({ kind: 'file', fileName: '../escape.csv', base64: 'eA==' }).success).toBe(false);
  expect(mappingInput.safeParse({ sheet: 'CSV', firstRow: 2, lastRow: 1, columns: [{ field: 'topic', column: 'A' }] }).success).toBe(false);
  expect(mappingInput.safeParse({ sheet: 'CSV', firstRow: 1, lastRow: 2, columns: [{ field: 'topic', column: 'A' },{ field: 'unit', column: 'A' }] }).success).toBe(false);
});

test('Links never permit executable, credential-bearing or private-address URLs', () => {
  for (const url of ['javascript:alert(1)','file:///etc/passwd','http://example.com','https://user:pass@example.com/a','https://127.0.0.1','https://[::1]','https://intranet.local','https://example.com:444/a']) expect(isSafeResourceUrl(url),url).toBe(false);
  expect(isSafeResourceUrl('https://docs.google.com/spreadsheets/d/example/edit')).toBe(true);
  const proposal = tabularAdapter.extract(readTabular(bytes('Topic\n=SUM(1)'), 'literal.csv'), { sheet:'CSV', firstRow:2,lastRow:2,columns:[{field:'topic',column:'A'}] });
  expect(proposal.nodes[0].assertions[0].text).toBe('=SUM(1)');
});

test('Assignment bindings select by date without relabeling superseded history', () => {
  const old = { id:'old', assignmentId:'a', curriculumVersionId:'v1', effectiveFrom:'2026-08-01', effectiveTo:'2027-07-31', previousBindingId:null, createdAt:'' } satisfies CurriculumBinding;
  const next = { ...old, id:'next', curriculumVersionId:'v2', effectiveFrom:'2027-01-01', effectiveTo:'2027-05-31', previousBindingId:'old' };
  const rows = [old,next]; const preserved = JSON.stringify(rows);
  expect(activeBinding(rows,'a','2026-12-01')?.curriculumVersionId).toBe('v1');
  expect(activeBinding(rows,'a','2027-01-01')?.curriculumVersionId).toBe('v2');
  expect(activeBinding(rows,'a','2027-06-01')).toBeUndefined(); // Never fall back to superseded v1.
  expect(activeBinding(rows,'b','2026-12-01')).toBeUndefined(); expect(JSON.stringify(rows)).toBe(preserved);
});
