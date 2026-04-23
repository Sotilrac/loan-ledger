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
});
