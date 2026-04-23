import { describe, expect, it } from 'vitest';
import { validateLoan, validateMappings } from '../src/io/validate.js';

describe('validateLoan', () => {
  it('accepts a minimal loan file', () => {
    const minimal = {
      schema_version: 1,
      property: {
        name: 'Primary',
        purchase_date: '2020-06-15',
        purchase_price: 500_000,
        currency: 'USD',
      },
      valuation: {
        current: { amount: 650_000, as_of: '2026-04-01', source: 'manual' as const },
      },
      loan: {
        principal: 400_000,
        annual_rate: 0.0325,
        term_months: 360,
        start_date: '2020-07-01',
        first_payment_date: '2020-08-01',
        payment_day: 1,
        escrow_monthly: 450,
        rate_schedule: [{ effective_date: '2020-07-01', annual_rate: 0.0325 }],
      },
    };
    const result = validateLoan(minimal);
    expect(result.ok).toBe(true);
  });

  it('rejects a non-ISO date string', () => {
    const bad = {
      schema_version: 1,
      property: {
        name: 'P',
        purchase_date: '15-06-2020',
        purchase_price: 1,
        currency: 'USD',
      },
      valuation: { current: { amount: 0, as_of: '2026-04-01', source: 'manual' as const } },
      loan: {
        principal: 1,
        annual_rate: 0,
        term_months: 12,
        start_date: '2020-07-01',
        first_payment_date: '2020-08-01',
        payment_day: 1,
        escrow_monthly: 0,
        rate_schedule: [{ effective_date: '2020-07-01', annual_rate: 0 }],
      },
    };
    const result = validateLoan(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.path.includes('purchase_date'))).toBe(true);
  });
});

describe('validateMappings', () => {
  it('accepts a mappings file with one mapping', () => {
    const file = {
      schema_version: 1,
      mappings: [
        {
          name: 'Chase',
          date_format: 'YYYY-MM-DD',
          columns: { date: 'Date', amount: 'Amount' },
        },
      ],
    };
    const result = validateMappings(file);
    expect(result.ok).toBe(true);
  });

  it('rejects a mapping with an unknown amount_sign', () => {
    const bad = {
      schema_version: 1,
      mappings: [
        {
          name: 'Bad',
          date_format: 'YYYY-MM-DD',
          amount_sign: 'mixed',
          columns: { date: 'Date', amount: 'Amount' },
        },
      ],
    };
    const result = validateMappings(bad);
    expect(result.ok).toBe(false);
  });
});
