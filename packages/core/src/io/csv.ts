import Papa from 'papaparse';
import type {
  CsvMapping,
  DateString,
  Payment,
  ValidationError,
  ValidationResult,
} from '../model/types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface IngestOptions {
  /** Override `skip_rows` on the mapping (useful for files with a pre-header blurb). */
  skipRows?: number;
}

/**
 * Parse a CSV string and apply a `CsvMapping` to produce `Payment` rows.
 *
 * The CSV is expected to have a header row; column names in the mapping refer
 * to that header. Rows filtered out by `mapping.filter` are silently dropped.
 * Rows that can't be converted (bad date, non-numeric amount) produce a
 * validation error and the whole ingest fails — no partial results.
 */
export function ingestCsv(
  source: string,
  mapping: CsvMapping,
  opts: IngestOptions = {},
): ValidationResult<Payment[]> {
  const skip = opts.skipRows ?? mapping.skip_rows ?? 0;
  const trimmed = skipLeadingLines(source, skip);

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: true,
    delimiter: mapping.delimiter,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      errors: parsed.errors.map((e) => ({
        path: `/row/${e.row ?? '?'}`,
        message: `CSV parse error: ${e.message}`,
        keyword: 'csv',
      })),
    };
  }

  const missing = requiredColumnsMissing(parsed.meta.fields ?? [], mapping);
  if (missing.length > 0) {
    return {
      ok: false,
      errors: missing.map((col) => ({
        path: '/columns',
        message: `CSV is missing column "${col}" required by mapping "${mapping.name}"`,
        keyword: 'csv',
      })),
    };
  }

  const payments: Payment[] = [];
  const errors: ValidationError[] = [];

  for (const [idx, row] of parsed.data.entries()) {
    if (mapping.filter && !matchesFilter(row, mapping.filter)) continue;

    const rowPath = `/row/${idx}`;
    const rawDate = row[mapping.columns.date] ?? '';
    const date = parseDate(rawDate, mapping.date_format);
    if (!date) {
      errors.push({
        path: rowPath,
        message: `invalid date "${rawDate}" (expected format: ${mapping.date_format})`,
        keyword: 'csv',
      });
      continue;
    }

    const rawAmount = row[mapping.columns.amount] ?? '';
    const amount = parseAmount(rawAmount, mapping.amount_sign);
    if (amount === null) {
      errors.push({
        path: rowPath,
        message: `invalid amount "${rawAmount}"`,
        keyword: 'csv',
      });
      continue;
    }

    const payment: Payment = { date, amount };
    assignNumericField(payment, 'principal', row, mapping.columns.principal);
    assignNumericField(payment, 'interest', row, mapping.columns.interest);
    assignNumericField(payment, 'escrow', row, mapping.columns.escrow);
    assignNumericField(payment, 'extra', row, mapping.columns.extra);
    if (mapping.columns.note) {
      const note = row[mapping.columns.note]?.trim();
      if (note) payment.note = note;
    }

    payments.push(payment);
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: payments };
}

function requiredColumnsMissing(headers: string[], mapping: CsvMapping): string[] {
  const need = [mapping.columns.date, mapping.columns.amount];
  return need.filter((col) => !headers.includes(col));
}

function skipLeadingLines(source: string, n: number): string {
  if (n <= 0) return source;
  const parts = source.split(/\r?\n/);
  return parts.slice(n).join('\n');
}

function matchesFilter(
  row: Record<string, string>,
  filter: { column: string; matches: string },
): boolean {
  const value = row[filter.column] ?? '';
  return new RegExp(filter.matches).test(value);
}

function parseAmount(raw: string, sign: CsvMapping['amount_sign']): number | null {
  const cleaned = raw.replace(/[\s,$]/g, '').replace(/^\((.+)\)$/, '-$1');
  if (cleaned === '' || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  // If the CSV expresses payments as negative (debit) numbers, flip.
  if (sign === 'negative') return -n;
  return n;
}

function assignNumericField(
  payment: Payment,
  key: 'principal' | 'interest' | 'escrow' | 'extra',
  row: Record<string, string>,
  column: string | undefined,
): void {
  if (!column) return;
  const raw = row[column] ?? '';
  if (raw === '') return;
  const n = parseAmount(raw, undefined);
  if (n !== null) payment[key] = n;
}

/**
 * Support a small set of date formats common in bank exports:
 *   YYYY-MM-DD, YYYY/MM/DD, MM/DD/YYYY, DD/MM/YYYY.
 *
 * Returns a YYYY-MM-DD string or `null` if the input can't be parsed with the
 * requested format.
 */
function parseDate(raw: string, format: string): DateString | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (ISO_DATE.test(trimmed) && (format === 'YYYY-MM-DD' || format === 'ISO')) {
    return trimmed;
  }

  const slashParts = trimmed.split('/');
  if (slashParts.length === 3) {
    const [a, b, c] = slashParts as [string, string, string];
    if (format === 'YYYY/MM/DD') return assemble(a, b, c);
    if (format === 'MM/DD/YYYY') return assemble(c, a, b);
    if (format === 'DD/MM/YYYY') return assemble(c, b, a);
    if (format === 'MM/DD/YY') return assemble(expandTwoDigitYear(c), a, b);
    if (format === 'DD/MM/YY') return assemble(expandTwoDigitYear(c), b, a);
  }

  return null;
}

/** Map a 2-digit year to 20xx (the convention for modern loan apps). */
function expandTwoDigitYear(y: string): string {
  if (/^\d{2}$/.test(y)) return `20${y}`;
  return y;
}

function assemble(y: string, m: string, d: string): DateString | null {
  if (!/^\d{4}$/.test(y) || !/^\d{1,2}$/.test(m) || !/^\d{1,2}$/.test(d)) return null;
  const mm = m.padStart(2, '0');
  const dd = d.padStart(2, '0');
  const iso = `${y}-${mm}-${dd}`;
  // Validate real calendar date.
  const asDate = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(asDate.getTime())) return null;
  const roundtrip = asDate.toISOString().slice(0, 10);
  return roundtrip === iso ? iso : null;
}
