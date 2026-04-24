import { describe, expect, it } from 'vitest';
import { applyMutation, applyMutations } from '../src/mutation/index.js';
import type { LoanFile, Mutation, Payment } from '../src/model/types.js';

/** Minimal 3-month fixture. Short term keeps the expected side-effects easy to read. */
function baseLoan(overrides: Partial<LoanFile> = {}): LoanFile {
  const loan: LoanFile = {
    schema_version: 1,
    property: {
      name: 'Test',
      purchase_date: '2024-01-01',
      purchase_price: 100_000,
      currency: 'USD',
    },
    valuation: { current: { amount: 110_000, as_of: '2024-01-01', source: 'manual' } },
    loan: {
      principal: 10_000,
      annual_rate: 0.05,
      term_months: 3,
      start_date: '2024-01-01',
      first_payment_date: '2024-02-01',
      payment_day: 1,
      escrow_monthly: 0,
      rate_schedule: [{ effective_date: '2024-01-01', annual_rate: 0.05 }],
    },
    payments: [
      { date: '2024-02-01', amount: 3400, note: 'first' },
      { date: '2024-03-01', amount: 3400, extra: 100, note: 'with extra' },
      { date: '2024-04-01', amount: 3400 },
    ],
    ...overrides,
  };
  return loan;
}

describe('applyMutation', () => {
  describe('forward mutations', () => {
    it('recurring_extra_principal inserts and augments payments across the range', () => {
      const loan = baseLoan({ payments: [] });
      const m: Mutation = {
        type: 'recurring_extra_principal',
        start_date: '2024-02-01',
        end_date: '2024-03-01',
        amount: 50,
      };
      const out = applyMutation(loan, m);
      expect(out.payments).toHaveLength(2);
      for (const p of out.payments!) {
        expect(p.extra).toBe(50);
        expect(p.amount).toBeGreaterThan(50);
      }
      // Payments outside [start, end] untouched.
      expect(out.payments!.some((p) => p.date === '2024-04-01')).toBe(false);
    });

    it('recurring_extra_principal adds to an existing payment rather than replacing it', () => {
      const loan = baseLoan();
      const before = loan.payments!.find((p) => p.date === '2024-03-01')!;
      const out = applyMutation(loan, {
        type: 'recurring_extra_principal',
        start_date: '2024-03-01',
        end_date: '2024-03-01',
        amount: 25,
      });
      const after = out.payments!.find((p) => p.date === '2024-03-01')!;
      expect(after.amount).toBe(before.amount + 25);
      expect(after.extra).toBe((before.extra ?? 0) + 25);
      expect(after.note).toBe(before.note);
    });

    it('one_time_extra adds a single payment on the given date', () => {
      const loan = baseLoan({ payments: [] });
      const out = applyMutation(loan, {
        type: 'one_time_extra',
        date: '2024-03-01',
        amount: 200,
      });
      expect(out.payments).toHaveLength(1);
      expect(out.payments![0]!.extra).toBe(200);
    });

    it('change_rate appends to the schedule when the date is new', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'change_rate',
        effective_date: '2024-03-01',
        annual_rate: 0.07,
      });
      expect(out.loan.rate_schedule).toHaveLength(2);
      expect(out.loan.rate_schedule[1]).toEqual({
        effective_date: '2024-03-01',
        annual_rate: 0.07,
      });
    });

    it('change_rate replaces an existing schedule entry at the same date', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'change_rate',
        effective_date: '2024-01-01',
        annual_rate: 0.06,
      });
      expect(out.loan.rate_schedule).toHaveLength(1);
      expect(out.loan.rate_schedule[0]!.annual_rate).toBe(0.06);
    });

    it('change_term updates term_months when effective on or before start_date', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'change_term',
        effective_date: '2024-01-01',
        term_months: 6,
      });
      expect(out.loan.term_months).toBe(6);
    });

    it('change_term is a no-op mid-life (v0 limitation documented in-code)', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'change_term',
        effective_date: '2024-06-01',
        term_months: 6,
      });
      expect(out).toEqual(loan);
    });

    it('stop_extra_payments zeroes future extras and subtracts them from amount', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'stop_extra_payments',
        effective_date: '2024-03-01',
      });
      const march = out.payments!.find((p) => p.date === '2024-03-01')!;
      expect(march.extra).toBe(0);
      expect(march.amount).toBe(3300);
      // Past payments untouched.
      expect(out.payments![0]).toEqual(loan.payments![0]);
    });

    it('change_escrow updates escrow_monthly when effective on or before start_date', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'change_escrow',
        effective_date: '2024-01-01',
        escrow_monthly: 300,
      });
      expect(out.loan.escrow_monthly).toBe(300);
    });

    it('change_escrow is a no-op mid-life (v0 limitation documented in-code)', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'change_escrow',
        effective_date: '2024-06-01',
        escrow_monthly: 300,
      });
      expect(out).toEqual(loan);
    });
  });

  describe('counterfactual mutations', () => {
    it('remove_payment drops a single payment by date', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, { type: 'remove_payment', date: '2024-03-01' });
      expect(out.payments).toHaveLength(2);
      expect(out.payments!.some((p) => p.date === '2024-03-01')).toBe(false);
    });

    it('remove_payments_where filters by note_contains (case-insensitive)', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, {
        type: 'remove_payments_where',
        note_contains: 'EXTRA',
      });
      expect(out.payments).toHaveLength(2);
      expect(out.payments!.every((p) => p.note !== 'with extra')).toBe(true);
    });

    it('remove_payments_where keeps everything when note_contains is omitted', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, { type: 'remove_payments_where' });
      expect(out.payments).toHaveLength(loan.payments!.length);
    });

    it('replace_payment swaps the payment at the given date', () => {
      const loan = baseLoan();
      const replacement: Payment = { date: '2024-03-01', amount: 1234, note: 'replaced' };
      const out = applyMutation(loan, {
        type: 'replace_payment',
        date: '2024-03-01',
        with: replacement,
      });
      const march = out.payments!.find((p) => p.date === '2024-03-01')!;
      expect(march).toEqual(replacement);
    });

    it('set_original_rate rewrites annual_rate and the first schedule entry', () => {
      const loan = baseLoan();
      const out = applyMutation(loan, { type: 'set_original_rate', annual_rate: 0.03 });
      expect(out.loan.annual_rate).toBe(0.03);
      expect(out.loan.rate_schedule[0]!.annual_rate).toBe(0.03);
    });
  });

  describe('applyMutations', () => {
    it('threads the result of each mutation into the next', () => {
      const loan = baseLoan();
      const out = applyMutations(loan, [
        { type: 'remove_payment', date: '2024-02-01' },
        { type: 'remove_payment', date: '2024-04-01' },
      ]);
      expect(out.payments).toHaveLength(1);
      expect(out.payments![0]!.date).toBe('2024-03-01');
    });

    it('returns the input when the mutations array is empty', () => {
      const loan = baseLoan();
      expect(applyMutations(loan, [])).toBe(loan);
    });
  });

  it('does not mutate the input loan', () => {
    const loan = baseLoan();
    const snapshot = JSON.stringify(loan);
    applyMutation(loan, { type: 'remove_payment', date: '2024-03-01' });
    expect(JSON.stringify(loan)).toBe(snapshot);
  });
});
