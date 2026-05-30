import { describe, expect, it } from 'vitest';
import { computeLoan } from '../src/engine/loanEngine.js';
import { validateLoan } from '../src/io/validate.js';
import { buildNewLoan } from '../src/newLoan.js';
import { todayISO } from '../src/util/date.js';

describe('buildNewLoan', () => {
  const input = { name: 'Quick eval', principal: 300_000, annualRatePercent: 6.5, termMonths: 360 };

  it('passes schema validation', () => {
    expect(validateLoan(buildNewLoan(input)).ok).toBe(true);
  });

  it('starts today and converts rate percent to a decimal', () => {
    const loan = buildNewLoan(input);
    expect(loan.loan.start_date).toBe(todayISO());
    expect(loan.loan.annual_rate).toBeCloseTo(0.065, 10);
    expect(loan.loan.rate_schedule).toEqual([
      { effective_date: todayISO(), annual_rate: loan.loan.annual_rate },
    ]);
  });

  it('derives first payment and payment day one month out', () => {
    const loan = buildNewLoan(input);
    expect(loan.loan.first_payment_date.slice(0, 7) >= todayISO().slice(0, 7)).toBe(true);
    expect(loan.loan.payment_day).toBe(Number(loan.loan.first_payment_date.slice(8, 10)));
  });

  it('seeds property value from the principal so equity math is sane', () => {
    const loan = buildNewLoan(input);
    expect(loan.property.purchase_price).toBe(input.principal);
    expect(loan.valuation.current.amount).toBe(input.principal);
  });

  it('computes a non-empty ledger with no payment history', () => {
    const loan = buildNewLoan(input);
    expect(loan.payments).toBeUndefined();
    const result = computeLoan(loan, { today: todayISO() });
    expect(result.ledger.length).toBe(input.termMonths);
  });
});
