import type {
  DateString,
  LoanFile,
  Payment,
  RateScheduleEntry,
  ScheduledExtra,
} from '../model/types.js';
import { addMonths, compareDates, parseISODate, toISODate, todayISO } from '../util/date.js';
import type {
  ActualPart,
  ComputeOptions,
  LedgerRow,
  LoanComputation,
  LoanSummary,
  ScheduledPart,
} from './types.js';

const ROUND = (n: number): number => Math.round(n * 100) / 100;

/**
 * Deterministic loan computation. Pure function: same input → same output.
 *
 * Walks the amortization schedule from `first_payment_date` for `term_months`,
 * re-amortizing whenever a `rate_schedule` entry takes effect. Actual payments
 * (if provided) are reconciled by date and fold back into a per-row `actual`
 * block. Summary totals are computed against `today` (overridable in tests).
 */
export function computeLoan(loan: LoanFile, opts: ComputeOptions = {}): LoanComputation {
  const today = opts.today ?? todayISO();
  const ledger = buildLedger(loan);
  const summary = buildSummary(loan, ledger, today);
  return { ledger, summary };
}

function buildLedger(loan: LoanFile): LedgerRow[] {
  const { principal, term_months, first_payment_date, escrow_monthly, rate_schedule } = loan.loan;
  const override = loan.loan.monthly_payment;
  const scheduledExtras = loan.loan.scheduled_extras ?? [];
  const actualsByDate = indexPaymentsByDate(loan.payments ?? []);
  const latestActualDate = (loan.payments ?? [])
    .map((p) => p.date)
    .reduce((a, b) => (a > b ? a : b), '');
  const sortedRateSchedule = [...rate_schedule].sort((a, b) =>
    compareDates(a.effective_date, b.effective_date),
  );

  const firstPayment = parseISODate(first_payment_date);
  const rows: LedgerRow[] = [];

  let scheduledBalance = principal;
  let actualBalance = principal;
  let monthlyPI =
    override ??
    computeMonthlyPayment(
      principal,
      currentRate(sortedRateSchedule, first_payment_date) / 12,
      term_months,
    );
  let lastRate = currentRate(sortedRateSchedule, first_payment_date);

  for (let period = 1; period <= term_months; period += 1) {
    const dateString = toISODate(addMonths(firstPayment, period - 1));
    const annualRate = currentRate(sortedRateSchedule, dateString);
    const monthlyRate = annualRate / 12;
    const remainingMonths = term_months - (period - 1);

    if (annualRate !== lastRate && override === undefined) {
      monthlyPI = computeMonthlyPayment(scheduledBalance, monthlyRate, remainingMonths);
      lastRate = annualRate;
    } else if (annualRate !== lastRate) {
      // Override active — keep the fixed P+I but update lastRate so interest is
      // calculated at the new rate going forward.
      lastRate = annualRate;
    }

    const scheduledExtra = extraForDate(scheduledExtras, dateString);
    const scheduled = buildScheduledRow(
      scheduledBalance,
      monthlyRate,
      monthlyPI,
      escrow_monthly,
      scheduledExtra,
    );
    scheduledBalance = scheduled.balance_after;

    const row: LedgerRow = {
      period,
      date: dateString,
      rate: annualRate,
      scheduled,
    };

    const actualPayment = actualsByDate.get(dateString);
    if (actualPayment) {
      const actual = applyActualPayment(actualPayment, actualBalance, monthlyRate, escrow_monthly);
      actualBalance = actual.balance_after;
      row.actual = actual;
    }

    rows.push(row);

    // Stop when the scheduled balance has paid off AND we've rendered every
    // historical actual. Without the actual-date gate, committed extras that
    // zero the schedule early would also chop off real payment history.
    if (scheduledBalance <= 0 && dateString >= latestActualDate) break;
  }

  return rows;
}

function indexPaymentsByDate(payments: Payment[]): Map<DateString, Payment> {
  const map = new Map<DateString, Payment>();
  for (const p of payments) map.set(p.date, p);
  return map;
}

function currentRate(schedule: RateScheduleEntry[], onDate: DateString): number {
  let active = schedule[0]?.annual_rate ?? 0;
  for (const entry of schedule) {
    if (entry.effective_date <= onDate) active = entry.annual_rate;
    else break;
  }
  return active;
}

function computeMonthlyPayment(balance: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return ROUND(balance / months);
  const factor = Math.pow(1 + monthlyRate, months);
  const raw = (balance * monthlyRate * factor) / (factor - 1);
  return ROUND(raw);
}

function buildScheduledRow(
  balance: number,
  monthlyRate: number,
  monthlyPI: number,
  escrow: number,
  extra: number,
): ScheduledPart {
  const interest = ROUND(balance * monthlyRate);
  let principal = ROUND(monthlyPI - interest);
  let payment = monthlyPI;

  if (principal >= balance) {
    principal = ROUND(balance);
    payment = ROUND(principal + interest);
    // Final payment already clears the balance — no room for a committed extra.
    return { payment, principal, interest, escrow, extra: 0, balance_after: 0 };
  }

  // Committed extra can't drive the balance below zero; clamp it if needed.
  const remainingAfterPrincipal = ROUND(balance - principal);
  const appliedExtra = Math.min(ROUND(extra), remainingAfterPrincipal);
  const balance_after = ROUND(remainingAfterPrincipal - appliedExtra);

  return {
    payment,
    principal,
    interest,
    escrow,
    extra: appliedExtra,
    balance_after,
  };
}

function extraForDate(extras: ScheduledExtra[], date: DateString): number {
  let total = 0;
  for (const e of extras) {
    if (date < e.start_date) continue;
    if (e.end_date !== undefined && date > e.end_date) continue;
    total += e.amount;
  }
  return total;
}

function applyActualPayment(
  payment: Payment,
  balance: number,
  monthlyRate: number,
  scheduledEscrow: number,
): ActualPart {
  const amount = ROUND(Math.abs(payment.amount));
  const abs = (n: number): number => ROUND(Math.abs(n));

  // Respect every explicit field independently. Anything missing is inferred
  // from the total amount minus the parts we already know.
  const explicitInterest = payment.interest !== undefined;
  const explicitEscrow = payment.escrow !== undefined;
  const explicitExtra = payment.extra !== undefined;
  const explicitPrincipal = payment.principal !== undefined;

  const interest = explicitInterest ? abs(payment.interest!) : ROUND(balance * monthlyRate);
  const escrow = explicitEscrow ? abs(payment.escrow!) : scheduledEscrow;
  let extra = explicitExtra ? abs(payment.extra!) : 0;
  let principal = explicitPrincipal
    ? abs(payment.principal!)
    : ROUND(amount - interest - escrow - extra);

  if (principal < 0) {
    principal = 0;
    if (!explicitExtra) extra = ROUND(Math.max(0, amount - interest - escrow));
  }

  const principalTotal = ROUND(principal + extra);
  const newBalance = ROUND(Math.max(0, balance - principalTotal));

  const result: ActualPart = {
    amount,
    principal,
    interest,
    escrow,
    extra,
    balance_after: newBalance,
  };
  if (payment.note) result.note = payment.note;
  return result;
}

function buildSummary(loan: LoanFile, ledger: LedgerRow[], today: DateString): LoanSummary {
  const scheduledPayoffDate = ledger[ledger.length - 1]?.date ?? loan.loan.first_payment_date;
  const firstProjectedPayoff = findFirstProjectedPayoffDate(ledger);

  let scheduledInterestToDate = 0;
  let actualInterestToDate = 0;
  let actualPrincipalToDate = 0;
  let actualExtraToDate = 0;
  let currentScheduledBalance = loan.loan.principal;
  let lastActualBalance: number | null = null;
  let paymentsMade = 0;

  for (const row of ledger) {
    if (row.date > today) break;
    scheduledInterestToDate = ROUND(scheduledInterestToDate + row.scheduled.interest);
    currentScheduledBalance = row.scheduled.balance_after;
    if (row.actual) {
      paymentsMade += 1;
      actualInterestToDate = ROUND(actualInterestToDate + row.actual.interest);
      actualPrincipalToDate = ROUND(actualPrincipalToDate + row.actual.principal);
      actualExtraToDate = ROUND(actualExtraToDate + row.actual.extra);
      lastActualBalance = row.actual.balance_after;
    }
  }

  const currentActualBalance = lastActualBalance ?? currentScheduledBalance;
  const valuation = loan.valuation.current;
  const equity = valuation ? ROUND(valuation.amount - currentActualBalance) : null;

  return {
    original_principal: loan.loan.principal,
    term_months: loan.loan.term_months,
    scheduled_payoff_date: scheduledPayoffDate,
    projected_payoff_date: firstProjectedPayoff ?? scheduledPayoffDate,
    current_scheduled_balance: currentScheduledBalance,
    current_actual_balance: currentActualBalance,
    scheduled_interest_to_date: scheduledInterestToDate,
    actual_interest_to_date: actualInterestToDate,
    actual_principal_to_date: actualPrincipalToDate,
    actual_extra_to_date: actualExtraToDate,
    payments_made: paymentsMade,
    equity,
    months_ahead_of_schedule: computeMonthsAhead(ledger, today),
  };
}

function findFirstProjectedPayoffDate(ledger: LedgerRow[]): DateString | null {
  for (const row of ledger) {
    if ((row.actual?.balance_after ?? row.scheduled.balance_after) <= 0) return row.date;
  }
  return null;
}

function computeMonthsAhead(ledger: LedgerRow[], today: DateString): number {
  let scheduledBalanceNow = 0;
  let actualBalanceNow = 0;
  for (const row of ledger) {
    if (row.date > today) break;
    scheduledBalanceNow = row.scheduled.balance_after;
    actualBalanceNow = row.actual?.balance_after ?? row.scheduled.balance_after;
  }
  if (actualBalanceNow >= scheduledBalanceNow) return 0;

  for (const row of ledger) {
    if (row.date <= today) continue;
    if (row.scheduled.balance_after <= actualBalanceNow) {
      return Math.max(0, monthsBetween(today, row.date));
    }
  }
  return 0;
}

function monthsBetween(earlier: DateString, later: DateString): number {
  const a = parseISODate(earlier);
  const b = parseISODate(later);
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}
