<script setup lang="ts">
import type { LoanComputation } from '@loan-ledger/core';
import { computed } from 'vue';
import { chartFont, chartMargin, chartPalette } from './palette.js';
import { formatMonthLabel, formatShortCurrency, linearScale, niceTicks } from './scale.js';

const props = defineProps<{
  computation: LoanComputation;
  /** Used for the vertical "today" rule and the past/future opacity split. */
  today?: string;
  currency?: string;
}>();

const width = 640;
const height = 240;
const plotW = width - chartMargin.left - chartMargin.right;
const plotH = height - chartMargin.top - chartMargin.bottom;

/**
 * Show the full amortization lifecycle, not just what's been paid. A
 * mid-life rate change can make interest-so-far look like it's rising
 * with time; extending the chart past "today" reveals the actual
 * "interest wedges down, principal wedges up" shape of the full loan.
 */
const rows = computed(() => {
  return props.computation.ledger.map((r) => {
    const actual = r.actual;
    const isFuture = props.today ? r.date > props.today : false;
    return {
      date: r.date,
      rate: r.rate,
      isFuture,
      principal: actual?.principal ?? r.scheduled.principal,
      interest: actual?.interest ?? r.scheduled.interest,
      escrow: actual?.escrow ?? r.scheduled.escrow,
      extra: actual?.extra ?? 0,
    };
  });
});

/** Index of the first future row; used to position the vertical "today" rule. */
const todayIndex = computed(() => {
  const idx = rows.value.findIndex((r) => r.isFuture);
  return idx < 0 ? rows.value.length : idx;
});

/**
 * Months where the rate changes relative to the previous row. Rendered as thin
 * vertical marks with a small italic label so the user understands a step in
 * the bar shape when one occurs.
 */
const rateChanges = computed(() => {
  const out: { i: number; rate: number; date: string }[] = [];
  for (let i = 1; i < rows.value.length; i += 1) {
    const prev = rows.value[i - 1]!;
    const cur = rows.value[i]!;
    if (cur.rate !== prev.rate) out.push({ i, rate: cur.rate, date: cur.date });
  }
  return out;
});

const fmtRate = (n: number): string => `${(n * 100).toFixed(2)}%`;

const maxTotal = computed(() => {
  let m = 0;
  for (const r of rows.value) {
    const total = r.principal + r.interest + r.escrow + r.extra;
    if (total > m) m = total;
  }
  return m * 1.05 || 1;
});

const x = computed(() => linearScale([0, Math.max(1, rows.value.length)], [0, plotW]));
const y = computed(() => linearScale([0, maxTotal.value], [plotH, 0]));
const yTicks = computed(() => niceTicks(0, maxTotal.value, 3));

const barWidth = computed(() => plotW / Math.max(1, rows.value.length));

function segment(
  index: number,
  base: number,
  value: number,
): { x: number; y: number; width: number; height: number } {
  const x0 = x.value(index);
  const xEnd = x.value(index + 1);
  const slot = xEnd - x0;
  // At 360 months the bars are sub-pixel; only carve out a gap if there's
  // enough width to spare. Below ~6px per slot the bars abut each other.
  const gap = slot > 6 ? 1 : 0;
  const y0 = y.value(base);
  const y1 = y.value(base + value);
  return {
    x: x0 + gap,
    y: y1,
    width: Math.max(0.5, slot - gap * 2),
    height: Math.max(0, y0 - y1),
  };
}

const xTicks = computed(() => {
  const total = rows.value.length;
  const interval = Math.max(1, Math.floor(total / 6));
  return rows.value.map((r, i) => ({ i, date: r.date })).filter((t) => t.i % interval === 0);
});
</script>

<template>
  <figure class="chart">
    <figcaption class="label">Payment composition</figcaption>
    <svg :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="Payment composition over time">
      <g :transform="`translate(${chartMargin.left}, ${chartMargin.top})`">
        <!-- Y-axis -->
        <text
          v-for="tick in yTicks"
          :key="tick"
          :x="-8"
          :y="y(tick)"
          text-anchor="end"
          dominant-baseline="middle"
          v-bind="chartFont.tick"
        >
          {{ formatShortCurrency(tick, props.currency) }}
        </text>

        <!-- X-axis -->
        <text
          v-for="tick in xTicks"
          :key="`x-${tick.i}`"
          :x="x(tick.i) + barWidth / 2"
          :y="plotH + 16"
          text-anchor="middle"
          v-bind="chartFont.tick"
        >
          {{ formatMonthLabel(tick.date) }}
        </text>

        <!-- Stacked bars: principal (bottom), interest, escrow, extra (top) -->
        <g v-for="(row, i) in rows" :key="row.date" :opacity="row.isFuture ? 0.6 : 1">
          <rect
            v-bind="segment(i, 0, row.principal)"
            :fill="chartPalette.composition.principal.fill"
          />
          <rect
            v-bind="segment(i, row.principal, row.interest)"
            :fill="chartPalette.composition.interest.fill"
            :fill-opacity="chartPalette.composition.interest.opacity"
          />
          <rect
            v-bind="segment(i, row.principal + row.interest, row.escrow)"
            :fill="chartPalette.composition.escrow.fill"
          />
          <rect
            v-if="row.extra > 0"
            v-bind="segment(i, row.principal + row.interest + row.escrow, row.extra)"
            :fill="chartPalette.composition.extra.fill"
          />
        </g>

        <!-- Rate-change marker(s): thin vertical rule + tiny italic serif label -->
        <g v-for="change in rateChanges" :key="`rate-${change.i}`">
          <line
            :x1="x(change.i)"
            :x2="x(change.i)"
            :y1="0"
            :y2="plotH"
            :stroke="chartPalette.annotation.rule"
            stroke-width="1"
          />
          <text :x="x(change.i) + 4" :y="12" v-bind="chartFont.annotation">
            rate → {{ fmtRate(change.rate) }}
          </text>
        </g>

        <!-- Today marker -->
        <g v-if="todayIndex > 0 && todayIndex < rows.length">
          <line
            :x1="x(todayIndex)"
            :x2="x(todayIndex)"
            :y1="0"
            :y2="plotH"
            :stroke="chartPalette.annotation.rule"
            stroke-width="1"
          />
          <text :x="x(todayIndex) + 4" :y="plotH - 4" v-bind="chartFont.annotation">today</text>
        </g>
      </g>
    </svg>
    <ul class="legend">
      <li>
        <span class="swatch" :style="{ background: chartPalette.composition.principal.fill }" />
        Principal
      </li>
      <li>
        <span
          class="swatch"
          :style="{
            background: chartPalette.composition.interest.fill,
            opacity: chartPalette.composition.interest.opacity,
          }"
        />
        Interest
      </li>
      <li>
        <span class="swatch" :style="{ background: chartPalette.composition.escrow.fill }" />
        Escrow
      </li>
      <li>
        <span class="swatch" :style="{ background: chartPalette.composition.extra.fill }" />
        Extra
      </li>
      <li class="caption">
        <em>Future months shown at 60% opacity.</em>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
}

.label {
  font-family: var(--ll-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0 0 0.5rem;
}

svg {
  width: 100%;
  height: auto;
  display: block;
}

.legend {
  display: flex;
  gap: 1.5rem;
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  color: var(--ll-ink-muted);
}

.legend li {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
}
</style>
