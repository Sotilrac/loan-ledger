import { describe, expect, it } from 'vitest';
import {
  addMonths,
  compareDates,
  isOnOrBefore,
  parseISODate,
  toISODate,
  todayISO,
} from '../../src/util/date.js';

describe('parseISODate', () => {
  it('returns a Date fixed at UTC midnight', () => {
    const d = parseISODate('2026-04-23');
    expect(d.toISOString()).toBe('2026-04-23T00:00:00.000Z');
  });

  it('throws on a malformed string', () => {
    expect(() => parseISODate('2026-4-3')).toThrow(RangeError);
    expect(() => parseISODate('not a date')).toThrow(RangeError);
  });

  it('throws on a non-existent calendar date', () => {
    expect(() => parseISODate('2026-02-30')).toThrow(RangeError);
  });
});

describe('toISODate', () => {
  it('formats UTC-midnight Date to YYYY-MM-DD', () => {
    expect(toISODate(parseISODate('2026-04-23'))).toBe('2026-04-23');
  });

  it('throws on an invalid Date', () => {
    expect(() => toISODate(new Date(NaN))).toThrow(RangeError);
  });
});

describe('addMonths', () => {
  it('adds months within the year', () => {
    expect(toISODate(addMonths(parseISODate('2026-01-01'), 2))).toBe('2026-03-01');
  });

  it('rolls across year boundary', () => {
    expect(toISODate(addMonths(parseISODate('2026-11-01'), 3))).toBe('2027-02-01');
  });

  it('clamps to last day of target month', () => {
    expect(toISODate(addMonths(parseISODate('2026-01-31'), 1))).toBe('2026-02-28');
    expect(toISODate(addMonths(parseISODate('2024-01-31'), 1))).toBe('2024-02-29');
  });

  it('accepts negative month offsets', () => {
    expect(toISODate(addMonths(parseISODate('2026-01-15'), -2))).toBe('2025-11-15');
  });
});

describe('compareDates', () => {
  it('returns -1/0/1 for less/equal/greater', () => {
    expect(compareDates('2020-01-01', '2020-01-02')).toBeLessThan(0);
    expect(compareDates('2020-01-01', '2020-01-01')).toBe(0);
    expect(compareDates('2020-01-02', '2020-01-01')).toBeGreaterThan(0);
  });
});

describe('isOnOrBefore', () => {
  it('includes equality', () => {
    expect(isOnOrBefore('2020-01-01', '2020-01-01')).toBe(true);
    expect(isOnOrBefore('2020-01-01', '2020-01-02')).toBe(true);
    expect(isOnOrBefore('2020-01-03', '2020-01-02')).toBe(false);
  });
});

describe('todayISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
