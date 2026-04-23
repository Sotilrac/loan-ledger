import { describe, expect, it } from 'vitest';
import { computeLoan } from '../../src/engine/loanEngine.js';
import type { LoanFile } from '../../src/model/types.js';

const FIXED_RATE_12_MONTHS: LoanFile = {
  schema_version: 1,
  property: {
    name: 'Test',
    purchase_date: '2026-01-01',
    purchase_price: 12_000,
    currency: 'USD',
  },
  valuation: {
    current: { amount: 15_000, as_of: '2026-06-01', source: 'manual' },
  },
  loan: {
    principal: 12_000,
    annual_rate: 0.06,
    term_months: 12,
    start_date: '2026-01-01',
    first_payment_date: '2026-02-01',
    payment_day: 1,
    escrow_monthly: 0,
    rate_schedule: [{ effective_date: '2026-01-01', annual_rate: 0.06 }],
  },
};

describe('computeLoan — fixed-rate amortization', () => {
  const result = computeLoan(FIXED_RATE_12_MONTHS, { today: '2026-02-02' });

  it('produces one ledger row per scheduled month', () => {
    expect(result.ledger).toHaveLength(12);
  });

  it('first payment matches the textbook $1032.80 breakdown at 6% / 12mo', () => {
    const first = result.ledger[0]!;
    expect(first.date).toBe('2026-02-01');
    expect(first.scheduled.payment).toBe(1032.8);
    expect(first.scheduled.interest).toBe(60.0);
    expect(first.scheduled.principal).toBe(972.8);
    expect(first.scheduled.balance_after).toBe(11027.2);
  });

  it('last scheduled row pays the loan to zero', () => {
    const last = result.ledger[result.ledger.length - 1]!;
    expect(last.scheduled.balance_after).toBe(0);
    expect(last.date).toBe('2027-01-01');
  });

  it('summary projected_payoff equals scheduled_payoff when no actuals', () => {
    expect(result.summary.scheduled_payoff_date).toBe('2027-01-01');
    expect(result.summary.projected_payoff_date).toBe('2027-01-01');
  });

  it('equity reflects valuation minus current balance', () => {
    const afterFirst = computeLoan(FIXED_RATE_12_MONTHS, { today: '2026-02-02' });
    // Valuation 15000 - scheduled balance after payment 1 (11027.2) = 3972.8
    expect(afterFirst.summary.equity).toBe(3972.8);
  });
});

describe('computeLoan — rate schedule (ARM)', () => {
  const arm: LoanFile = {
    ...FIXED_RATE_12_MONTHS,
    loan: {
      ...FIXED_RATE_12_MONTHS.loan,
      term_months: 24,
      rate_schedule: [
        { effective_date: '2026-01-01', annual_rate: 0.06 },
        { effective_date: '2026-08-01', annual_rate: 0.12 },
      ],
    },
  };

  const result = computeLoan(arm, { today: '2026-02-02' });

  it('uses the original rate for early payments', () => {
    expect(result.ledger[0]!.rate).toBe(0.06);
    expect(result.ledger[5]!.rate).toBe(0.06);
  });

  it('switches to the new rate after the effective date', () => {
    const jump = result.ledger.find((r) => r.date === '2026-08-01')!;
    expect(jump.rate).toBe(0.12);
    // Payment on Aug 1 should be recomputed — expect it to be larger than the pre-change P+I.
    expect(jump.scheduled.payment).toBeGreaterThan(result.ledger[0]!.scheduled.payment);
  });

  it('fully amortizes by the final scheduled row', () => {
    const last = result.ledger[result.ledger.length - 1]!;
    expect(last.scheduled.balance_after).toBe(0);
  });
});

describe('computeLoan — actual payments', () => {
  const withActuals: LoanFile = {
    ...FIXED_RATE_12_MONTHS,
    payments: [
      { date: '2026-02-01', amount: 1032.8, note: 'ordinary payment' },
      { date: '2026-03-01', amount: 1532.8, note: 'paid $500 extra', extra: 500 },
    ],
  };

  const result = computeLoan(withActuals, { today: '2026-03-15' });

  it('matches scheduled values when actual == scheduled', () => {
    const feb = result.ledger[0]!;
    expect(feb.actual?.amount).toBe(1032.8);
    expect(feb.actual?.balance_after).toBe(feb.scheduled.balance_after);
  });

  it('applies extra principal to the actual balance', () => {
    const mar = result.ledger[1]!;
    expect(mar.actual?.extra).toBe(500);
    expect(mar.actual?.balance_after).toBeLessThan(mar.scheduled.balance_after);
  });

  it('summary reflects actual principal + extra paid to date', () => {
    expect(result.summary.payments_made).toBe(2);
    expect(result.summary.actual_extra_to_date).toBe(500);
    expect(result.summary.current_actual_balance).toBeLessThan(
      result.summary.current_scheduled_balance,
    );
    expect(result.summary.months_ahead_of_schedule).toBeGreaterThan(0);
  });
});

describe('computeLoan — no escrow, zero-rate edge case', () => {
  const zeroRate: LoanFile = {
    ...FIXED_RATE_12_MONTHS,
    loan: {
      ...FIXED_RATE_12_MONTHS.loan,
      annual_rate: 0,
      principal: 1200,
      term_months: 12,
      rate_schedule: [{ effective_date: '2026-01-01', annual_rate: 0 }],
    },
    valuation: { current: { amount: 1200, as_of: '2026-02-01', source: 'manual' } },
  };

  const result = computeLoan(zeroRate, { today: '2026-02-02' });

  it('monthly payment is principal / term when rate is zero', () => {
    expect(result.ledger[0]!.scheduled.payment).toBe(100);
    expect(result.ledger[0]!.scheduled.interest).toBe(0);
    expect(result.ledger[0]!.scheduled.principal).toBe(100);
  });
});

describe('computeLoan — actual payment with explicit breakdown', () => {
  const loan: LoanFile = {
    ...FIXED_RATE_12_MONTHS,
    payments: [
      {
        date: '2026-02-01',
        amount: 1032.8,
        principal: 972.8,
        interest: 60,
        escrow: 0,
        extra: 0,
      },
    ],
  };

  const result = computeLoan(loan, { today: '2026-02-15' });

  it('uses the explicit breakdown rather than inferring', () => {
    const feb = result.ledger[0]!;
    expect(feb.actual?.principal).toBe(972.8);
    expect(feb.actual?.interest).toBe(60);
  });
});
