import { describe, expect, it } from 'vitest';
import { computeLoan } from '../../src/engine/loanEngine.js';
import { evaluateScenario } from '../../src/engine/scenarioEngine.js';
import { applyMutation } from '../../src/mutation/index.js';
import type { LoanFile, Mutation, Scenario } from '../../src/model/types.js';

const BASE_LOAN: LoanFile = {
  schema_version: 1,
  property: {
    name: 'Base',
    purchase_date: '2024-01-01',
    purchase_price: 12_000,
    currency: 'USD',
  },
  valuation: { current: { amount: 15_000, as_of: '2024-06-01', source: 'manual' } },
  loan: {
    principal: 12_000,
    annual_rate: 0.06,
    term_months: 12,
    start_date: '2024-01-01',
    first_payment_date: '2024-02-01',
    payment_day: 1,
    escrow_monthly: 0,
    rate_schedule: [{ effective_date: '2024-01-01', annual_rate: 0.06 }],
  },
};

describe('applyMutation — forward', () => {
  it('recurring_extra_principal bumps each monthly actual by the extra', () => {
    const m: Mutation = {
      type: 'recurring_extra_principal',
      start_date: '2024-02-01',
      end_date: '2024-04-01',
      amount: 100,
    };
    const out = applyMutation(BASE_LOAN, m);
    expect(out.payments).toHaveLength(3);
    expect(out.payments?.[0]?.extra).toBe(100);
    expect(out.payments?.[2]?.date).toBe('2024-04-01');
  });

  it('one_time_extra adds a single extra payment', () => {
    const m: Mutation = { type: 'one_time_extra', date: '2024-03-01', amount: 2500 };
    const out = applyMutation(BASE_LOAN, m);
    expect(out.payments).toHaveLength(1);
    expect(out.payments?.[0]?.extra).toBe(2500);
  });

  it('change_rate inserts into rate_schedule sorted', () => {
    const m: Mutation = {
      type: 'change_rate',
      effective_date: '2024-06-01',
      annual_rate: 0.1,
    };
    const out = applyMutation(BASE_LOAN, m);
    expect(out.loan.rate_schedule).toHaveLength(2);
    expect(out.loan.rate_schedule[1]?.annual_rate).toBe(0.1);
  });

  it('stop_extra_payments zeroes extras after the effective date', () => {
    const withExtras = applyMutation(BASE_LOAN, {
      type: 'recurring_extra_principal',
      start_date: '2024-02-01',
      end_date: '2024-05-01',
      amount: 50,
    });
    const stopped = applyMutation(withExtras, {
      type: 'stop_extra_payments',
      effective_date: '2024-04-01',
    });
    expect(stopped.payments?.[0]?.extra).toBe(50);
    expect(stopped.payments?.[2]?.extra).toBe(0);
    // Amount on Apr drops back to the baseline scheduled payment (P+I = 1032.80).
    expect(stopped.payments?.[2]?.amount).toBe(1032.8);
  });

  it('change_term at origination updates term_months', () => {
    const out = applyMutation(BASE_LOAN, {
      type: 'change_term',
      effective_date: '2024-01-01',
      term_months: 24,
    });
    expect(out.loan.term_months).toBe(24);
  });

  it('change_term mid-life is a no-op in v0', () => {
    const out = applyMutation(BASE_LOAN, {
      type: 'change_term',
      effective_date: '2024-06-01',
      term_months: 24,
    });
    expect(out.loan.term_months).toBe(12);
  });
});

describe('applyMutation — counterfactual', () => {
  const withActuals: LoanFile = {
    ...BASE_LOAN,
    payments: [
      { date: '2024-02-01', amount: 1032.8 },
      { date: '2024-03-01', amount: 1532.8, extra: 500, note: 'bonus' },
      { date: '2024-04-01', amount: 1032.8 },
    ],
  };

  it('remove_payment drops by date', () => {
    const out = applyMutation(withActuals, { type: 'remove_payment', date: '2024-03-01' });
    expect(out.payments).toHaveLength(2);
  });

  it('remove_payments_where filters by note substring', () => {
    const out = applyMutation(withActuals, {
      type: 'remove_payments_where',
      note_contains: 'bonus',
    });
    expect(out.payments).toHaveLength(2);
    expect(out.payments?.every((p) => !p.note?.includes('bonus'))).toBe(true);
  });

  it('replace_payment swaps a matching payment', () => {
    const replacement = { date: '2024-03-01', amount: 1032.8 };
    const out = applyMutation(withActuals, {
      type: 'replace_payment',
      date: '2024-03-01',
      with: replacement,
    });
    expect(out.payments?.[1]).toEqual(replacement);
  });

  it('set_original_rate rewrites the first rate_schedule entry', () => {
    const out = applyMutation(BASE_LOAN, { type: 'set_original_rate', annual_rate: 0.08 });
    expect(out.loan.rate_schedule[0]?.annual_rate).toBe(0.08);
    expect(out.loan.annual_rate).toBe(0.08);
  });
});

describe('evaluateScenario', () => {
  it('produces a positive interest_saved delta for recurring extra principal', () => {
    const scenario: Scenario = {
      id: 'extra-100',
      name: 'Add $100/mo',
      mutations: [{ type: 'recurring_extra_principal', start_date: '2024-02-01', amount: 100 }],
    };
    const evalResult = evaluateScenario(BASE_LOAN, scenario, { today: '2024-12-31' });
    expect(evalResult.delta.interest_saved).toBeGreaterThan(0);
    expect(evalResult.delta.months_sooner).toBeGreaterThan(0);
    expect(evalResult.scenario.summary.current_actual_balance).toBeLessThan(
      evalResult.baseline.summary.current_actual_balance,
    );
  });

  it('counterfactual: removing extra payments shows what you gained', () => {
    const loanWithExtras: LoanFile = {
      ...BASE_LOAN,
      payments: [
        { date: '2024-02-01', amount: 1032.8 },
        { date: '2024-03-01', amount: 1532.8, extra: 500, note: 'bonus' },
        { date: '2024-04-01', amount: 1032.8 },
      ],
    };
    const scenario: Scenario = {
      id: 'no-bonus',
      name: 'Without the bonus payment',
      mutations: [{ type: 'remove_payments_where', note_contains: 'bonus' }],
    };
    const ev = evaluateScenario(loanWithExtras, scenario, { today: '2024-05-01' });
    // Scenario has a WORSE position than baseline (higher balance, more interest),
    // because we stripped the helpful payment. So interest_saved is NEGATIVE.
    expect(ev.delta.interest_saved).toBeLessThan(0);
    expect(ev.delta.balance_delta_now).toBeLessThan(0);
  });

  it('no mutations means zero delta', () => {
    const ev = evaluateScenario(
      BASE_LOAN,
      { id: 'noop', name: 'Nothing', mutations: [] },
      { today: '2024-06-01' },
    );
    expect(ev.delta.interest_saved).toBe(0);
    expect(ev.delta.months_sooner).toBe(0);
    expect(ev.baseline).toEqual(ev.scenario);
  });
});

describe('composed mutations', () => {
  it('applies mutations in order (recurring then stop)', () => {
    const scenario: Scenario = {
      id: 'bumpy',
      name: 'Extras until June',
      mutations: [
        { type: 'recurring_extra_principal', start_date: '2024-02-01', amount: 50 },
        { type: 'stop_extra_payments', effective_date: '2024-06-01' },
      ],
    };
    const ev = evaluateScenario(BASE_LOAN, scenario, { today: '2024-12-31' });
    const laterPayments = ev.transformed_loan.payments?.filter((p) => p.date >= '2024-06-01');
    expect(laterPayments?.every((p) => (p.extra ?? 0) === 0)).toBe(true);
  });
});

describe('evaluateScenario equals loanEngine when scenario is empty', () => {
  it('baseline computation matches direct computeLoan', () => {
    const ev = evaluateScenario(
      BASE_LOAN,
      { id: 'empty', name: '', mutations: [] },
      { today: '2024-06-01' },
    );
    const direct = computeLoan(BASE_LOAN, { today: '2024-06-01' });
    expect(ev.baseline).toEqual(direct);
  });
});
