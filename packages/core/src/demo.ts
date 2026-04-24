import { computeLoan } from './engine/loanEngine.js';
import type { LoanFile, Payment } from './model/types.js';
import { toISODate } from './util/date.js';

/**
 * Demo loan used as a fallback when the web app has no file open, and as a
 * secondary test input. The rate schedule flips mid-life to simulate a
 * refinance, and the generated actuals include a stretch of extra-principal
 * payments so the "what have your extra payments saved you" counterfactual
 * has something interesting to show.
 */
export function buildDemoLoan(): LoanFile {
  const base: LoanFile = {
    schema_version: 1,
    property: {
      name: 'Maple Cottage (demo)',
      address: '123 Maple Street, Exampleville, NY 10001',
      purchase_date: '2020-06-15',
      purchase_price: 525_000,
      currency: 'USD',
      year_built: 1998,
      bedrooms: 3,
      bathrooms: 2,
      square_feet: 1_850,
      lot_size_sqft: 6_500,
      links: [
        {
          label: 'Loan Ledger README',
          url: 'https://gitlab.com/sotilrac/loan-ledger/-/blob/main/README.md',
        },
        {
          label: 'Wikipedia: Sugar maple',
          url: 'https://en.wikipedia.org/wiki/Acer_saccharum',
        },
      ],
      notes:
        'Stand-in data so you can see how the dashboard reads a real file. Tap Edit to change any field, or Load loan to open your own .loan.yaml. Your file never leaves this browser.',
    },
    valuation: {
      current: {
        amount: 685_000,
        as_of: '2026-04-01',
        source: 'manual',
      },
      history: [
        { amount: 525_000, as_of: '2020-06-15', source: 'manual' },
        { amount: 610_000, as_of: '2022-06-01', source: 'manual' },
        { amount: 650_000, as_of: '2024-06-01', source: 'manual' },
      ],
    },
    loan: {
      principal: 450_000,
      annual_rate: 0.0325,
      term_months: 360,
      start_date: '2020-07-01',
      first_payment_date: '2020-08-01',
      payment_day: 1,
      escrow_monthly: 420,
      rate_schedule: [
        { effective_date: '2020-07-01', annual_rate: 0.0325 },
        { effective_date: '2023-09-01', annual_rate: 0.055 },
      ],
      scheduled_extras: [
        {
          start_date: '2023-06-01',
          end_date: '2025-12-01',
          amount: 200,
          note: 'Committed extra principal during the 2023–2025 stretch',
        },
      ],
    },
    scenarios: [
      {
        id: 'extra-500',
        name: 'Add $500/mo in 2026',
        description:
          'What if, starting May 2026, every monthly payment included $500 of extra principal?',
        mutations: [
          {
            type: 'recurring_extra_principal',
            start_date: '2026-05-01',
            amount: 500,
          },
        ],
      },
      {
        id: 'what-if-no-extras',
        name: 'Counterfactual: no extras',
        description:
          'Re-runs the ledger as if none of your past extra-principal payments had happened. Useful for seeing how much time and interest those extras saved.',
        mutations: [{ type: 'remove_payments_where', note_contains: 'extra' }],
      },
    ],
  };

  base.payments = generateDemoPayments(base);
  return base;
}

/**
 * Build an actual-payment history that spans from the first scheduled payment
 * up to (but not including) today. Most months match the scheduled amount;
 * a stretch from mid-2023 through end-of-2025 adds $200 extra principal;
 * a few months in 2025 add an extra $500.
 */
function generateDemoPayments(loan: LoanFile): Payment[] {
  const computed = computeLoan({ ...loan, payments: [] }, { today: '9999-12-31' });
  const today = toISODate(new Date());
  const payments: Payment[] = [];

  for (const row of computed.ledger) {
    if (row.date >= today) break;
    const bonus = extraBonusFor(row.date);
    const amount = round2(row.scheduled.payment + row.scheduled.escrow + bonus);
    const payment: Payment = { date: row.date, amount };
    if (bonus > 0) {
      payment.extra = bonus;
      payment.note = 'extra principal';
    }
    payments.push(payment);
  }

  return payments;
}

function extraBonusFor(date: string): number {
  if (date >= '2025-06-01' && date <= '2025-11-01') return 500;
  if (date >= '2023-06-01' && date < '2026-01-01') return 200;
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Frozen demo loan computed once at module load — refreshes on next import. */
export const DEMO_LOAN: Readonly<LoanFile> = Object.freeze(buildDemoLoan());
