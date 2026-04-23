import type { DateString } from '../model/types.js';

export interface ScheduledPart {
  payment: number;
  principal: number;
  interest: number;
  escrow: number;
  /** Committed recurring extra principal applied this month (may be 0). */
  extra: number;
  balance_after: number;
}

export interface ActualPart {
  amount: number;
  principal: number;
  interest: number;
  escrow: number;
  extra: number;
  balance_after: number;
  note?: string;
}

export interface LedgerRow {
  period: number;
  date: DateString;
  rate: number;
  scheduled: ScheduledPart;
  actual?: ActualPart;
}

export interface LoanSummary {
  original_principal: number;
  term_months: number;
  scheduled_payoff_date: DateString;
  projected_payoff_date: DateString;
  current_scheduled_balance: number;
  current_actual_balance: number;
  scheduled_interest_to_date: number;
  actual_interest_to_date: number;
  actual_principal_to_date: number;
  actual_extra_to_date: number;
  payments_made: number;
  equity: number | null;
  months_ahead_of_schedule: number;
}

export interface LoanComputation {
  ledger: LedgerRow[];
  summary: LoanSummary;
}

export interface ComputeOptions {
  /** Override "today" for deterministic tests. Defaults to today's UTC date. */
  today?: DateString;
}
