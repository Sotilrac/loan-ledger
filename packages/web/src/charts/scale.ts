/**
 * Minimal linear scales + tick generators. Hand-rolled because D3 is overkill
 * for three charts and we want the style of the ticks to be the same as
 * hand-typeset numbers elsewhere in the app.
 */

export interface Scale {
  (value: number): number;
  domain: [number, number];
  range: [number, number];
}

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  const fn = (value: number): number => r0 + ((value - d0) / span) * (r1 - r0);
  return Object.assign(fn, { domain, range });
}

/**
 * Nicely-rounded tick values within [min, max], ~count target.
 * Uses the "nice numbers" algorithm (1/2/5 multiples) for readable ticks.
 */
export function niceTicks(min: number, max: number, count: number = 5): number[] {
  if (min === max) return [min];
  const range = max - min;
  const rough = range / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const residual = rough / magnitude;
  let step: number;
  if (residual >= 5) step = 10 * magnitude;
  else if (residual >= 2) step = 5 * magnitude;
  else if (residual >= 1) step = 2 * magnitude;
  else step = magnitude;

  const first = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = first; v <= max + step * 0.001; v += step) {
    ticks.push(round(v));
  }
  return ticks;
}

/** Format a large number as "$450k" / "$12.5k" / "$800". */
export function formatShortCurrency(n: number, currency: string = 'USD'): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const symbol = currencySymbol(currency);
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${abs.toFixed(0)}`;
}

export function formatMonthLabel(iso: string): string {
  const [y, m] = iso.split('-');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${monthNames[Number(m) - 1]} ${y?.slice(2)}`;
}

function round(n: number): number {
  return Math.abs(n) < 1e-10 ? 0 : Number(n.toPrecision(12));
}

function currencySymbol(code: string): string {
  switch (code) {
    case 'USD':
    case 'CAD':
    case 'AUD':
      return '$';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    default:
      return '';
  }
}
