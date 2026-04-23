import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ingestCsv } from '../src/io/csv.js';
import type { CsvMapping } from '../src/model/types.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixture = (p: string): string => resolve(here, 'fixtures', p);

const chaseMapping: CsvMapping = {
  name: 'Chase (test)',
  date_format: 'YYYY-MM-DD',
  amount_sign: 'negative',
  columns: {
    date: 'Date',
    amount: 'Amount',
    note: 'Description',
  },
  filter: { column: 'Description', matches: 'Mortgage Payment' },
};

describe('ingestCsv', () => {
  it('produces Payment rows from a bank CSV with a mapping', async () => {
    const csv = await readFile(fixture('csv-samples/chase-basic.csv'), 'utf-8');
    const result = ingestCsv(csv, chaseMapping);
    if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
    expect(result.value).toHaveLength(3);
    expect(result.value[0]).toEqual({
      date: '2026-01-01',
      amount: 2190.65,
      note: 'Mortgage Payment',
    });
    expect(result.value[2]?.amount).toBe(2300);
  });

  it('fails cleanly when the date is malformed', async () => {
    const csv = await readFile(fixture('csv-samples/chase-bad-date.csv'), 'utf-8');
    const result = ingestCsv(csv, chaseMapping);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toMatch(/invalid date/);
  });

  it('reports missing mapped columns', () => {
    const csv = 'X,Y\n1,2\n';
    const result = ingestCsv(csv, chaseMapping);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('missing column "Date"'))).toBe(true);
  });

  it('supports MM/DD/YYYY dates', () => {
    const csv = 'd,a\n01/15/2026,-100\n';
    const mapping: CsvMapping = {
      name: 'US-format',
      date_format: 'MM/DD/YYYY',
      amount_sign: 'negative',
      columns: { date: 'd', amount: 'a' },
    };
    const result = ingestCsv(csv, mapping);
    if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
    expect(result.value[0]?.date).toBe('2026-01-15');
    expect(result.value[0]?.amount).toBe(100);
  });
});
