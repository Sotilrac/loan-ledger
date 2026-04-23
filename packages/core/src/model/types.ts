/**
 * Date-only string in ISO 8601 extended form: YYYY-MM-DD.
 * Times are never stored — the core normalizes to UTC midnight internally.
 */
export type DateString = string;

/** ISO 4217 currency code, e.g. "USD", "EUR". Per-loan display hint only. */
export type Currency = string;

export interface RateScheduleEntry {
  effective_date: DateString;
  annual_rate: number;
}

export interface Property {
  name: string;
  purchase_date: DateString;
  purchase_price: number;
  currency: Currency;
}

export type ValuationSource = 'manual' | 'custom_url';

export interface Valuation {
  amount: number;
  as_of: DateString;
  source: ValuationSource;
  url?: string;
}

export interface ValuationBlock {
  current: Valuation;
  history?: Valuation[];
}

export interface LoanTerms {
  principal: number;
  annual_rate: number;
  term_months: number;
  start_date: DateString;
  first_payment_date: DateString;
  payment_day: number;
  escrow_monthly: number;
  rate_schedule: RateScheduleEntry[];
}

export interface Payment {
  date: DateString;
  amount: number;
  principal?: number;
  interest?: number;
  escrow?: number;
  extra?: number;
  note?: string;
}

export type Mutation =
  | {
      type: 'recurring_extra_principal';
      start_date: DateString;
      end_date?: DateString;
      amount: number;
    }
  | { type: 'one_time_extra'; date: DateString; amount: number }
  | { type: 'change_rate'; effective_date: DateString; annual_rate: number }
  | { type: 'change_term'; effective_date: DateString; term_months: number }
  | { type: 'stop_extra_payments'; effective_date: DateString }
  | { type: 'change_escrow'; effective_date: DateString; escrow_monthly: number }
  | { type: 'remove_payment'; date: DateString }
  | { type: 'remove_payments_where'; note_contains?: string }
  | { type: 'replace_payment'; date: DateString; with: Payment }
  | { type: 'set_original_rate'; annual_rate: number };

export type MutationType = Mutation['type'];

export interface Scenario {
  id: string;
  name: string;
  description?: string;
  mutations: Mutation[];
}

export interface LoanFile {
  schema_version: 1;
  property: Property;
  valuation: ValuationBlock;
  loan: LoanTerms;
  payments?: Payment[];
  scenarios?: Scenario[];
}

export type AmountSign = 'positive' | 'negative';

export interface CsvColumnMap {
  date: string;
  amount: string;
  principal?: string;
  interest?: string;
  escrow?: string;
  extra?: string;
  note?: string;
}

export interface CsvMapping {
  name: string;
  delimiter?: string;
  date_format: string;
  amount_sign?: AmountSign;
  skip_rows?: number;
  columns: CsvColumnMap;
  filter?: { column: string; matches: string };
}

export interface MappingsFile {
  schema_version: 1;
  mappings: CsvMapping[];
}

export interface ValidationError {
  path: string;
  message: string;
  keyword?: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };
