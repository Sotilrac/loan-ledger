<script setup lang="ts">
import type { LoanComputation } from '@loan-ledger/core';
import { computed } from 'vue';
import { chartFont, chartMargin, chartPalette } from './palette.js';
import { formatMonthLabel, formatShortCurrency, linearScale, niceTicks } from './scale.js';

const props = defineProps<{
  computation: LoanComputation;
  /** Only show rows up to this date (exclusive of projected future months). */
  today?: string;
  currency?: string;
}>();

const width = 640;
const height = 240;
const plotW = width - chartMargin.left - chartMargin.right;
const plotH = height - chartMargin.top - chartMargin.bottom;

const rows = computed(() => {
  return props.computation.ledger
    .filter((r) => (props.today ? r.date <= props.today : true))
    .map((r) => {
      const actual = r.actual;
      // Each segment height is the dollar contribution for that payment.
      return {
        date: r.date,
        principal: actual?.principal ?? r.scheduled.principal,
        interest: actual?.interest ?? r.scheduled.interest,
        escrow: actual?.escrow ?? r.scheduled.escrow,
        extra: actual?.extra ?? 0,
      };
    });
});

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
  const y0 = y.value(base);
  const y1 = y.value(base + value);
  return {
    x: x0 + 1, // tiny gap between bars for visual separation
    y: y1,
    width: Math.max(0, xEnd - x0 - 2),
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

        <!-- Stacked bars: interest (bottom), escrow, principal, extra (top) -->
        <g v-for="(row, i) in rows" :key="row.date">
          <rect
            v-bind="segment(i, 0, row.interest)"
            :fill="chartPalette.composition.interest.fill"
            :fill-opacity="chartPalette.composition.interest.opacity"
          />
          <rect
            v-bind="segment(i, row.interest, row.escrow)"
            :fill="chartPalette.composition.escrow.fill"
          />
          <rect
            v-bind="segment(i, row.interest + row.escrow, row.principal)"
            :fill="chartPalette.composition.principal.fill"
          />
          <rect
            v-if="row.extra > 0"
            v-bind="segment(i, row.interest + row.escrow + row.principal, row.extra)"
            :fill="chartPalette.composition.extra.fill"
          />
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
