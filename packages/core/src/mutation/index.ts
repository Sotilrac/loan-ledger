import { computeLoan } from '../engine/loanEngine.js';
import type { DateString, LoanFile, Mutation, Payment, RateScheduleEntry } from '../model/types.js';
import { addMonths, parseISODate, toISODate } from '../util/date.js';

/**
 * Apply a single mutation to a loan, returning a new `LoanFile`. Pure.
 */
export function applyMutation(loan: LoanFile, mutation: Mutation): LoanFile {
  switch (mutation.type) {
    case 'recurring_extra_principal':
      return applyRecurringExtraPrincipal(loan, mutation);
    case 'one_time_extra':
      return applyOneTimeExtra(loan, mutation);
    case 'change_rate':
      return applyChangeRate(loan, mutation);
    case 'change_term':
      return applyChangeTerm(loan, mutation);
    case 'stop_extra_payments':
      return applyStopExtraPayments(loan, mutation);
    case 'change_escrow':
      return applyChangeEscrow(loan, mutation);
    case 'remove_payment':
      return applyRemovePayment(loan, mutation);
    case 'remove_payments_where':
      return applyRemovePaymentsWhere(loan, mutation);
    case 'replace_payment':
      return applyReplacePayment(loan, mutation);
    case 'set_original_rate':
      return applySetOriginalRate(loan, mutation);
  }
}

/** Apply every mutation in order, threading the result. */
export function applyMutations(loan: LoanFile, mutations: Mutation[]): LoanFile {
  return mutations.reduce<LoanFile>((acc, m) => applyMutation(acc, m), loan);
}

// ---------------------------------------------------------------------------
// Forward mutations — they add hypothetical actual payments or reshape terms.
// ---------------------------------------------------------------------------

function applyRecurringExtraPrincipal(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'recurring_extra_principal' }>,
): LoanFile {
  const payments = [...(loan.payments ?? [])];
  const byDate = indexByDate(payments);
  const endDate = m.end_date ?? endOfLoanDate(loan);
  const firstPayment = parseISODate(loan.loan.first_payment_date);
  const scheduledByDate = scheduledAmountByDate(loan);

  for (let i = 0; i < loan.loan.term_months; i += 1) {
    const d = toISODate(addMonths(firstPayment, i));
    if (d < m.start_date) continue;
    if (d > endDate) break;
    addExtraAt(payments, byDate, d, m.amount, scheduledByDate);
  }
  return { ...loan, payments };
}

function applyOneTimeExtra(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'one_time_extra' }>,
): LoanFile {
  const payments = [...(loan.payments ?? [])];
  addExtraAt(payments, indexByDate(payments), m.date, m.amount, scheduledAmountByDate(loan));
  return { ...loan, payments };
}

function applyChangeRate(loan: LoanFile, m: Extract<Mutation, { type: 'change_rate' }>): LoanFile {
  const schedule: RateScheduleEntry[] = [...loan.loan.rate_schedule];
  const idx = schedule.findIndex((e) => e.effective_date === m.effective_date);
  if (idx >= 0) {
    schedule[idx] = { effective_date: m.effective_date, annual_rate: m.annual_rate };
  } else {
    schedule.push({ effective_date: m.effective_date, annual_rate: m.annual_rate });
    schedule.sort((a, b) => (a.effective_date < b.effective_date ? -1 : 1));
  }
  return { ...loan, loan: { ...loan.loan, rate_schedule: schedule } };
}

function applyChangeTerm(loan: LoanFile, m: Extract<Mutation, { type: 'change_term' }>): LoanFile {
  if (m.effective_date > loan.loan.start_date) {
    // Mid-life term changes re-amortize the remaining balance. Not implemented
    // in v0 — users who need this can run two scenarios back-to-back.
    return loan;
  }
  return { ...loan, loan: { ...loan.loan, term_months: m.term_months } };
}

function applyStopExtraPayments(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'stop_extra_payments' }>,
): LoanFile {
  const payments = (loan.payments ?? []).map((p) => {
    if (p.date < m.effective_date) return p;
    if (!p.extra) return p;
    const reduced: Payment = {
      ...p,
      amount: round2(p.amount - p.extra),
      extra: 0,
    };
    return reduced;
  });
  return { ...loan, payments };
}

function applyChangeEscrow(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'change_escrow' }>,
): LoanFile {
  if (m.effective_date > loan.loan.start_date) {
    // Mid-life escrow changes require an escrow_schedule concept; v0 punts.
    return loan;
  }
  return { ...loan, loan: { ...loan.loan, escrow_monthly: m.escrow_monthly } };
}

// ---------------------------------------------------------------------------
// Counterfactual mutations — they rewrite existing actual payments to answer
// "what if I had never done X?".
// ---------------------------------------------------------------------------

function applyRemovePayment(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'remove_payment' }>,
): LoanFile {
  const payments = (loan.payments ?? []).filter((p) => p.date !== m.date);
  return { ...loan, payments };
}

function applyRemovePaymentsWhere(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'remove_payments_where' }>,
): LoanFile {
  const needle = m.note_contains?.toLowerCase();
  const payments = (loan.payments ?? []).filter((p) => {
    if (needle !== undefined) {
      const note = p.note?.toLowerCase() ?? '';
      return !note.includes(needle);
    }
    return true;
  });
  return { ...loan, payments };
}

function applyReplacePayment(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'replace_payment' }>,
): LoanFile {
  const payments = (loan.payments ?? []).map((p) => (p.date === m.date ? m.with : p));
  return { ...loan, payments };
}

function applySetOriginalRate(
  loan: LoanFile,
  m: Extract<Mutation, { type: 'set_original_rate' }>,
): LoanFile {
  const firstEntry = loan.loan.rate_schedule[0];
  if (!firstEntry) return loan;
  const schedule = [
    { effective_date: firstEntry.effective_date, annual_rate: m.annual_rate },
    ...loan.loan.rate_schedule.slice(1),
  ];
  return {
    ...loan,
    loan: { ...loan.loan, annual_rate: m.annual_rate, rate_schedule: schedule },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function indexByDate(payments: Payment[]): Map<string, number> {
  const m = new Map<string, number>();
  payments.forEach((p, i) => m.set(p.date, i));
  return m;
}

function addExtraAt(
  payments: Payment[],
  byDate: Map<string, number>,
  date: string,
  amount: number,
  scheduledByDate: Map<DateString, number>,
): void {
  const idx = byDate.get(date);
  if (idx !== undefined) {
    const existing = payments[idx]!;
    const updated: Payment = {
      ...existing,
      amount: round2(existing.amount + amount),
      extra: round2((existing.extra ?? 0) + amount),
    };
    payments[idx] = updated;
  } else {
    const baseAmount = scheduledByDate.get(date) ?? 0;
    const inserted: Payment = {
      date,
      amount: round2(baseAmount + amount),
      extra: round2(amount),
    };
    payments.push(inserted);
    byDate.set(date, payments.length - 1);
  }
}

/** Compute the baseline scheduled amount (P+I+escrow) per payment date. */
function scheduledAmountByDate(loan: LoanFile): Map<DateString, number> {
  const baseline = computeLoan({ ...loan, payments: [] }, { today: '9999-12-31' });
  const map = new Map<DateString, number>();
  for (const row of baseline.ledger) {
    map.set(row.date, round2(row.scheduled.payment + row.scheduled.escrow));
  }
  return map;
}

function endOfLoanDate(loan: LoanFile): string {
  const first = parseISODate(loan.loan.first_payment_date);
  return toISODate(addMonths(first, loan.loan.term_months - 1));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
