import { describe, expect, it } from 'vitest';
import { buildDemoLoan } from '../src/demo.js';
import { computeLoan } from '../src/engine/loanEngine.js';
import { validateLoan } from '../src/io/validate.js';

describe('buildDemoLoan', () => {
  it('passes schema validation', () => {
    const demo = buildDemoLoan();
    const result = validateLoan(demo);
    expect(result.ok).toBe(true);
  });

  it('has a rate schedule with the pre-set refinance', () => {
    const demo = buildDemoLoan();
    expect(demo.loan.rate_schedule).toHaveLength(2);
    expect(demo.loan.rate_schedule[1]!.effective_date).toBe('2023-09-01');
  });

  it('computes without error and shows equity', () => {
    const demo = buildDemoLoan();
    const result = computeLoan(demo, { today: '2026-04-01' });
    expect(result.ledger.length).toBeGreaterThan(0);
    expect(result.summary.equity).toBeGreaterThan(0);
    expect(result.summary.payments_made).toBeGreaterThan(50);
  });

  /*
   * Snapshot the computed summary for a fixed `today`. This catches any
   * accidental change to the demo (rates, payment stream, valuation)
   * that would shift the published numbers. Update deliberately if you
   * intend to change what the demo shows.
   */
  it('summary at 2026-04-01 matches the committed snapshot', () => {
    const demo = buildDemoLoan();
    const { summary } = computeLoan(demo, { today: '2026-04-01' });
    // Round to cents to insulate from float noise across platforms.
    const round = (n: number | null | undefined): number | null | undefined =>
      typeof n === 'number' ? Math.round(n * 100) / 100 : n;
    expect({
      original_principal: summary.original_principal,
      term_months: summary.term_months,
      scheduled_payoff_date: summary.scheduled_payoff_date,
      projected_payoff_date: summary.projected_payoff_date,
      current_scheduled_balance: round(summary.current_scheduled_balance),
      current_actual_balance: round(summary.current_actual_balance),
      scheduled_interest_to_date: round(summary.scheduled_interest_to_date),
      actual_interest_to_date: round(summary.actual_interest_to_date),
      actual_principal_to_date: round(summary.actual_principal_to_date),
      actual_extra_to_date: round(summary.actual_extra_to_date),
      payments_made: summary.payments_made,
      equity: round(summary.equity),
      months_ahead_of_schedule: summary.months_ahead_of_schedule,
    }).toMatchSnapshot();
  });
});
