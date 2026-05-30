import type { LoanFile } from './model/types.js';
import { addMonths, parseISODate, toISODate, todayISO } from './util/date.js';

/** Minimal inputs to spin up a loan for quick what-if evaluation. */
export interface NewLoanInput {
  /** Property / loan label. */
  name: string;
  /** Loan amount in the property currency. */
  principal: number;
  /** Annual interest rate as a percentage, e.g. 6.5 for 6.5%. */
  annualRatePercent: number;
  /** Loan term in whole months. */
  termMonths: number;
  /** ISO 4217 currency code. Defaults to USD. */
  currency?: string;
}

/**
 * Build a minimal but schema-valid loan starting today, with no payment
 * history or scenarios. Property value defaults to the loan principal so the
 * equity math has something sensible to start from; everything is editable
 * afterwards. Companion to {@link buildDemoLoan} for the "New loan" flow.
 */
export function buildNewLoan(input: NewLoanInput): LoanFile {
  const today = todayISO();
  const firstPayment = toISODate(addMonths(parseISODate(today), 1));
  const annualRate = input.annualRatePercent / 100;
  const currency = input.currency ?? 'USD';

  return {
    schema_version: 1,
    property: {
      name: input.name,
      purchase_date: today,
      purchase_price: input.principal,
      currency,
    },
    valuation: {
      current: {
        amount: input.principal,
        as_of: today,
        source: 'manual',
      },
    },
    loan: {
      principal: input.principal,
      annual_rate: annualRate,
      term_months: input.termMonths,
      start_date: today,
      first_payment_date: firstPayment,
      payment_day: parseISODate(firstPayment).getUTCDate(),
      escrow_monthly: 0,
      rate_schedule: [{ effective_date: today, annual_rate: annualRate }],
    },
  };
}
