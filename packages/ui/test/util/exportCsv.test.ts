import type { LoanComputation } from '@loan-ledger/core';
import { describe, expect, it } from 'vitest';
import { loanComputationToCsv } from '../../src/util/exportCsv.js';

function row(
  over: Partial<LoanComputation['ledger'][number]> = {},
): LoanComputation['ledger'][number] {
  return {
    period: 1,
    date: '2025-01-01',
    rate: 0.0415,
    scheduled: {
      payment: 1000,
      principal: 500,
      interest: 400,
      escrow: 100,
      extra: 0,
      balance_after: 99500,
    },
    ...over,
  };
}

function buildComputation(ledger: LoanComputation['ledger']): LoanComputation {
  return {
    ledger,
    summary: {
      original_principal: 100000,
      term_months: 360,
      scheduled_payoff_date: '2055-01-01',
      projected_payoff_date: '2055-01-01',
      current_scheduled_balance: 99500,
      current_actual_balance: 99500,
      scheduled_interest_to_date: 0,
      actual_interest_to_date: 0,
      actual_principal_to_date: 0,
      actual_extra_to_date: 0,
      payments_made: 0,
      equity: null,
      months_ahead_of_schedule: 0,
    },
  };
}

describe('loanComputationToCsv', () => {
  it('emits a header row and one data row per ledger entry', () => {
    const csv = loanComputationToCsv(buildComputation([row()]));
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'period,date,rate,payment,principal,interest,escrow,extra,balance,type,note',
    );
  });

  it('uses scheduled values and `scheduled` type when there is no actual', () => {
    const csv = loanComputationToCsv(buildComputation([row()]));
    const data = csv.trim().split('\r\n')[1];
    expect(data).toBe(
      '1,2025-01-01,0.041500,1100.00,500.00,400.00,100.00,0.00,99500.00,scheduled,',
    );
  });

  it('uses actual values and `actual` type when an actual payment exists', () => {
    const csv = loanComputationToCsv(
      buildComputation([
        row({
          actual: {
            amount: 1200,
            principal: 600,
            interest: 400,
            escrow: 100,
            extra: 100,
            balance_after: 99400,
          },
        }),
      ]),
    );
    const data = csv.trim().split('\r\n')[1];
    expect(data).toBe('1,2025-01-01,0.041500,1200.00,600.00,400.00,100.00,100.00,99400.00,actual,');
  });

  it('escapes commas, quotes and newlines in notes', () => {
    const csv = loanComputationToCsv(
      buildComputation([
        row({
          actual: {
            amount: 1000,
            principal: 500,
            interest: 400,
            escrow: 100,
            extra: 0,
            balance_after: 99500,
            note: 'paid early, "ahead" of schedule\nthanks',
          },
        }),
      ]),
    );
    const data = csv.trim().split('\r\n').slice(1).join('\r\n');
    expect(data).toContain('"paid early, ""ahead"" of schedule\nthanks"');
  });
});
