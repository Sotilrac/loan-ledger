<script setup lang="ts">
import type { LoanComputation, ScenarioEvaluation } from '@loan-ledger/core';
import { todayISO } from '@loan-ledger/core';
import { computed } from 'vue';
import { useLoanStore } from '../stores/loan.js';
import { chartFont, chartMargin, chartPalette } from './palette.js';
import { formatMonthLabel, formatShortCurrency, linearScale, niceTicks } from './scale.js';

const props = defineProps<{
  computation: LoanComputation;
  scenarios?: Map<string, ScenarioEvaluation>;
  currency?: string;
  /** Override "today" for tests and demos. */
  today?: string;
}>();

const width = 640;
const height = 280;
const plotW = width - chartMargin.left - chartMargin.right;
const plotH = height - chartMargin.top - chartMargin.bottom;

const today = computed(() => props.today ?? todayISO());

const points = computed(() => {
  return props.computation.ledger.map((row, i) => ({
    x: i,
    date: row.date,
    scheduled: row.scheduled.balance_after,
    actual: row.actual?.balance_after,
    isFuture: row.date > today.value,
  }));
});

const domainX: [number, number] = [0, Math.max(1, props.computation.ledger.length - 1)];
const domainY = computed<[number, number]>(() => {
  const max = props.computation.ledger[0]?.scheduled.balance_after ?? 0;
  return [0, max * 1.02];
});

const x = computed(() => linearScale(domainX, [0, plotW]));
const y = computed(() => linearScale(domainY.value, [plotH, 0]));

const yTicks = computed(() => niceTicks(domainY.value[0], domainY.value[1], 4));

const xTicks = computed(() => {
  const total = props.computation.ledger.length;
  const interval = Math.max(1, Math.floor(total / 6));
  return props.computation.ledger
    .map((r, i) => ({ i, date: r.date }))
    .filter((t) => t.i % interval === 0);
});

function pathFor(
  selector: (p: (typeof points.value)[number]) => number | undefined,
  splitAt?: string,
): { past: string; future: string } {
  const coords = points.value.map((p) => ({
    x: x.value(p.x),
    y: selector(p),
    date: p.date,
  }));
  const past: string[] = [];
  const future: string[] = [];
  let pastEnd: { x: number; y: number } | null = null;
  for (const c of coords) {
    if (c.y === undefined) continue;
    const pt = { x: c.x, y: y.value(c.y) };
    if (!splitAt || c.date <= splitAt) {
      past.push(past.length === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`);
      pastEnd = pt;
    } else {
      if (future.length === 0 && pastEnd) {
        future.push(`M${pastEnd.x},${pastEnd.y}`);
      }
      future.push(future.length === 0 ? `M${pt.x},${pt.y}` : `L${pt.x},${pt.y}`);
    }
  }
  return { past: past.join(' '), future: future.join(' ') };
}

const scheduledPath = computed(() => pathFor((p) => p.scheduled, today.value));
const actualPath = computed(() => pathFor((p) => p.actual, today.value));

const todayX = computed(() => {
  const idx = props.computation.ledger.findIndex((r) => r.date > today.value);
  const ledgerX = idx >= 0 ? idx - 0.5 : props.computation.ledger.length;
  return x.value(Math.max(0, ledgerX));
});

const scenarioPaths = computed(() => {
  if (!props.scenarios) return [];
  const entries = Array.from(props.scenarios.values());
  return entries.map((evalResult, idx) => {
    const color = chartPalette.scenarios[idx % chartPalette.scenarios.length]!;
    const coords = evalResult.scenario.ledger.map((row, i) => ({
      x: x.value(i),
      y: y.value(row.actual?.balance_after ?? row.scheduled.balance_after),
    }));
    const d = coords.map((c, i) => (i === 0 ? `M${c.x},${c.y}` : `L${c.x},${c.y}`)).join(' ');
    return { d, color, name: Array.from(props.scenarios!.keys())[idx] };
  });
});

// Hover state — shared with the amortization table via the Pinia store.
const store = useLoanStore();
const hoverPoint = computed(() => {
  if (store.selectedPeriod == null) return null;
  return points.value[store.selectedPeriod - 1] ?? null;
});

function onMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * width;
  const relX = px - chartMargin.left;
  if (relX < 0 || relX > plotW) {
    store.setSelectedPeriod(null);
    return;
  }
  const domX = (relX / plotW) * (domainX[1] - domainX[0]) + domainX[0];
  const idx = Math.round(domX);
  const clamped = Math.max(0, Math.min(points.value.length - 1, idx));
  store.setSelectedPeriod(clamped + 1);
}

function onLeave() {
  store.setSelectedPeriod(null);
}
</script>

<template>
  <figure class="chart">
    <figcaption class="label">Balance over time</figcaption>
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      aria-label="Loan balance over time"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <g :transform="`translate(${chartMargin.left}, ${chartMargin.top})`">
        <!-- Y-axis ticks (text only, no grid lines per style guide) -->
        <g class="axis">
          <text
            v-for="tick in yTicks"
            :key="`y-${tick}`"
            :x="-8"
            :y="y(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            v-bind="chartFont.tick"
          >
            {{ formatShortCurrency(tick, props.currency) }}
          </text>
        </g>

        <!-- X-axis ticks -->
        <g class="axis">
          <text
            v-for="tick in xTicks"
            :key="`x-${tick.i}`"
            :x="x(tick.i)"
            :y="plotH + 16"
            text-anchor="middle"
            v-bind="chartFont.tick"
          >
            {{ formatMonthLabel(tick.date) }}
          </text>
        </g>

        <!-- Baseline y=0 rule -->
        <line
          :x1="0"
          :x2="plotW"
          :y1="y(0)"
          :y2="y(0)"
          :stroke="chartPalette.annotation.rule"
          stroke-width="1"
        />

        <!-- Today annotation -->
        <line
          :x1="todayX"
          :x2="todayX"
          :y1="0"
          :y2="plotH"
          :stroke="chartPalette.annotation.rule"
          stroke-width="1"
        />
        <text :x="todayX + 4" :y="10" v-bind="chartFont.annotation">today</text>

        <!-- Scheduled balance line: thin Ink Blue @ 0.7 -->
        <path
          :d="scheduledPath.past"
          fill="none"
          :stroke="chartPalette.scheduled.stroke"
          :stroke-opacity="chartPalette.scheduled.opacity"
          :stroke-width="chartPalette.scheduled.width"
        />
        <path
          :d="scheduledPath.future"
          fill="none"
          :stroke="chartPalette.scheduled.stroke"
          :stroke-opacity="chartPalette.scheduled.opacity"
          :stroke-width="chartPalette.scheduled.width"
          :stroke-dasharray="chartPalette.projection.dash"
        />

        <!-- Actual balance line: thick Marigold @ 1.0 -->
        <path
          :d="actualPath.past"
          fill="none"
          :stroke="chartPalette.actual.stroke"
          :stroke-opacity="chartPalette.actual.opacity"
          :stroke-width="chartPalette.actual.width"
        />

        <!-- Scenario overlays -->
        <path
          v-for="scen in scenarioPaths"
          :key="scen.name"
          :d="scen.d"
          fill="none"
          :stroke="scen.color"
          stroke-width="1.5"
          stroke-dasharray="6 3"
          stroke-opacity="0.85"
        />

        <!-- Hover readout -->
        <g v-if="hoverPoint">
          <line
            :x1="x(hoverPoint.x)"
            :x2="x(hoverPoint.x)"
            :y1="0"
            :y2="plotH"
            :stroke="chartPalette.annotation.rule"
            stroke-width="1"
          />
          <circle
            v-if="hoverPoint.actual !== undefined"
            :cx="x(hoverPoint.x)"
            :cy="y(hoverPoint.actual)"
            r="3.5"
            :fill="chartPalette.actual.stroke"
          />
          <circle
            :cx="x(hoverPoint.x)"
            :cy="y(hoverPoint.scheduled)"
            r="2.5"
            :fill="chartPalette.scheduled.stroke"
            :fill-opacity="chartPalette.scheduled.opacity"
          />
        </g>
      </g>
    </svg>
    <div v-if="hoverPoint" class="tooltip">
      <p class="tooltip-date">{{ formatMonthLabel(hoverPoint.date) }}</p>
      <dl>
        <div>
          <dt>Scheduled</dt>
          <dd>{{ formatShortCurrency(hoverPoint.scheduled, props.currency) }}</dd>
        </div>
        <div v-if="hoverPoint.actual !== undefined">
          <dt>Actual</dt>
          <dd>{{ formatShortCurrency(hoverPoint.actual, props.currency) }}</dd>
        </div>
      </dl>
    </div>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
  position: relative;
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
  height: 100%;
  display: block;
  cursor: crosshair;
}

.tooltip {
  position: absolute;
  top: 2rem;
  right: 1rem;
  background: var(--ll-paper-raised);
  padding: 0.75rem 1rem;
  min-width: 160px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 6%);
  pointer-events: none;
  font-family: var(--ll-font-sans);
}

.tooltip-date {
  font-family: var(--ll-font-serif);
  font-size: 0.875rem;
  margin: 0 0 0.5rem;
  color: var(--ll-ink);
}

.tooltip dl {
  margin: 0;
  display: grid;
  gap: 0.25rem;
}

.tooltip div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.tooltip dt {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
  letter-spacing: 0.04em;
}

.tooltip dd {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}
</style>
