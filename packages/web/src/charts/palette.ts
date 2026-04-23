/**
 * Chart palette, lifted from `style-guide.md`. These are resolved CSS custom
 * properties at runtime. Anywhere chart code uses a color, it goes through
 * here so the graphical language stays consistent across charts.
 */

export const chartPalette = {
  scheduled: {
    stroke: 'var(--ll-accent)',
    opacity: 0.7,
    width: 1.5,
  },
  actual: {
    stroke: 'var(--ll-mark)',
    opacity: 1,
    width: 2.5,
  },
  projection: {
    dash: '4 2',
  },
  axis: {
    tick: 'var(--ll-ink-muted)',
    label: 'var(--ll-ink-muted)',
  },
  annotation: {
    rule: 'var(--ll-ink-faint)',
    label: 'var(--ll-ink-muted)',
  },
  scenarios: ['#5c6b7e', '#8a7d5c', '#6d8a5c', '#7e5c8a', '#8a5c6b'],
  composition: {
    principal: { fill: 'var(--ll-accent)', opacity: 1 },
    interest: { fill: 'var(--ll-accent)', opacity: 0.5 },
    escrow: { fill: 'var(--ll-ink-faint)', opacity: 1 },
    extra: { fill: 'var(--ll-mark)', opacity: 1 },
  },
  gauge: {
    track: 'var(--ll-ink-faint)',
    fill: 'var(--ll-mark)',
  },
} as const;

/** Shared margin for all chart components. Leaves room for axis labels. */
export const chartMargin = {
  top: 16,
  right: 20,
  bottom: 28,
  left: 56,
} as const;

export const chartFont = {
  microLabel: {
    fontFamily: 'var(--ll-font-sans)',
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    fill: 'var(--ll-ink-muted)',
  },
  tick: {
    fontFamily: 'var(--ll-font-sans)',
    fontSize: '0.75rem',
    fill: 'var(--ll-ink-muted)',
    fontFeatureSettings: '"tnum" 1, "lnum" 1',
  },
  annotation: {
    fontFamily: 'var(--ll-font-serif)',
    fontSize: '0.75rem',
    fontStyle: 'italic' as const,
    fill: 'var(--ll-ink-muted)',
  },
  heroNumber: {
    fontFamily: 'var(--ll-font-serif)',
    fontWeight: 400,
  },
} as const;
