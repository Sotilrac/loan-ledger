/**
 * Shared number- and date-formatting helpers used across the dashboard. Keep
 * these framework-free so they're callable from components, stores, and
 * (eventually) the Nextcloud target.
 */

/** "$1,234.56" style. Full precision. */
export function fmtCents(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(n);
}

/** "$1,234" style. No decimals. Use where space is tight. */
export function fmtCentsCompact(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** "3.250%" — three decimals, typical for loan rates. */
export function fmtPercent(n: number): string {
  return `${(n * 100).toFixed(3)}%`;
}

/** "43.2%" — one decimal, used for LTV / equity / appreciation percentages. */
export function fmtPct1(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * Human label for a month delta. Positive is "+N yrs M mo" (ahead),
 * negative is "−N yrs M mo" (behind), zero is "On schedule".
 */
export function monthsLabel(n: number): string {
  if (n === 0) return 'On schedule';
  const abs = Math.abs(n);
  const years = Math.floor(abs / 12);
  const rem = abs % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rem) parts.push(`${rem} mo`);
  if (!parts.length) parts.push('0 mo');
  return (n > 0 ? '+' : '−') + parts.join(' ');
}
