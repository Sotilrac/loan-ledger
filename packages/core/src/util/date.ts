import type { DateString } from '../model/types.js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a `YYYY-MM-DD` string into a `Date` fixed at UTC midnight.
 * Throws if the input doesn't match the ISO date shape or isn't a real
 * calendar date.
 */
export function parseISODate(s: DateString): Date {
  if (!ISO_DATE.test(s)) {
    throw new RangeError(`invalid date string: "${s}" (expected YYYY-MM-DD)`);
  }
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new RangeError(`invalid calendar date: "${s}"`);
  }
  return d;
}

/** Format a UTC-midnight `Date` back to `YYYY-MM-DD`. */
export function toISODate(d: Date): DateString {
  if (Number.isNaN(d.getTime())) {
    throw new RangeError('cannot format invalid Date');
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Return a new UTC date `months` months after `d`, clamping the day-of-month to
 * the last valid day of the target month (e.g. Jan 31 + 1 month → Feb 28/29).
 */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();

  const targetMonth = m + months;
  const targetYear = y + Math.floor(targetMonth / 12);
  const normMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = daysInMonth(targetYear, normMonth);
  const clampedDay = Math.min(day, lastDay);

  return new Date(Date.UTC(targetYear, normMonth, clampedDay));
}

/** Compare two date strings: negative if a < b, 0 if equal, positive if a > b. */
export function compareDates(a: DateString, b: DateString): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** True when `a` is on or before `b`. */
export function isOnOrBefore(a: DateString, b: DateString): boolean {
  return a <= b;
}

/** Today's date in UTC, as YYYY-MM-DD. */
export function todayISO(): DateString {
  return toISODate(new Date());
}

function daysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(Date.UTC(year, monthZeroIndexed + 1, 0)).getUTCDate();
}
