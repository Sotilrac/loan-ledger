import type { LoanComputation } from '@loan-ledger/core';

/**
 * Serialize a `LoanComputation` ledger as CSV. Numbers are emitted as plain
 * decimal values (no currency symbols, no thousand separators) so spreadsheets
 * parse them as numbers; rate is emitted as a decimal fraction (e.g. 0.0415).
 *
 * Each row reflects what the user sees in the amortization table: when an
 * actual payment exists the actual amounts are emitted, otherwise the
 * scheduled values are emitted and the row is flagged `projected`.
 */
export function loanComputationToCsv(computation: LoanComputation): string {
  const header = [
    'period',
    'date',
    'rate',
    'payment',
    'principal',
    'interest',
    'escrow',
    'extra',
    'balance',
    'type',
    'note',
  ];

  const lines: string[] = [header.join(',')];

  for (const row of computation.ledger) {
    const a = row.actual;
    const s = row.scheduled;
    const payment = a ? a.amount : s.payment + s.escrow;
    const principal = a ? a.principal : s.principal;
    const interest = a ? a.interest : s.interest;
    const escrow = a ? a.escrow : s.escrow;
    const extra = a ? a.extra : (s.extra ?? 0);
    const balance = a ? a.balance_after : s.balance_after;
    const type = a ? 'actual' : 'scheduled';
    const note = a?.note ?? '';

    lines.push(
      [
        String(row.period),
        row.date,
        formatNumber(row.rate, 6),
        formatNumber(payment, 2),
        formatNumber(principal, 2),
        formatNumber(interest, 2),
        formatNumber(escrow, 2),
        formatNumber(extra, 2),
        formatNumber(balance, 2),
        type,
        escapeCsv(note),
      ].join(','),
    );
  }

  return lines.join('\r\n') + '\r\n';
}

function formatNumber(n: number, digits: number): string {
  return Number.isFinite(n) ? n.toFixed(digits) : '';
}

function escapeCsv(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
