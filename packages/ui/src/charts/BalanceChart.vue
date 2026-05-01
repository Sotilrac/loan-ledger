<script setup lang="ts">
import type { LoanComputation, ScenarioEvaluation } from '@loan-ledger/core';
import { todayISO } from '@loan-ledger/core';
import { computed, onMounted, watch } from 'vue';
import { useLoanStore } from '../stores/loan.js';
import { chartMargin, chartPalette } from './palette.js';
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

const domainX = computed<[number, number]>(() => [
  0,
  Math.max(1, props.computation.ledger.length - 1),
]);
const domainY = computed<[number, number]>(() => {
  const max = props.computation.ledger[0]?.scheduled.balance_after ?? 0;
  return [0, max * 1.02];
});

const x = computed(() => linearScale(domainX.value, [0, plotW]));
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

/**
 * "Continue as you are" projection: start from the current actual balance and
 * amortize forward using the contractual P+I (no future extras). Stored as a
 * per-ledger-index series so the hover tooltip can look up the projected
 * balance at any future point.
 */
const currentStateSeries = computed<{ index: number; balance: number }[]>(() => {
  const rows = props.computation.ledger;
  if (!rows.length) return [];
  const startIdx = rows.findIndex((r) => r.date > today.value);
  if (startIdx < 0) return [];
  const prevIdx = Math.max(0, startIdx - 1);
  const lastActualBalance =
    rows[prevIdx]?.actual?.balance_after ?? rows[prevIdx]?.scheduled.balance_after ?? 0;

  const series: { index: number; balance: number }[] = [
    { index: prevIdx, balance: lastActualBalance },
  ];
  let bal = lastActualBalance;
  for (let i = startIdx; i < rows.length; i += 1) {
    const row = rows[i]!;
    const monthlyRate = row.rate / 12;
    const interest = Math.round(bal * monthlyRate * 100) / 100;
    const principal = Math.max(0, row.scheduled.payment - interest);
    bal = Math.max(0, bal - principal);
    series.push({ index: i, balance: bal });
    if (bal <= 0) break;
  }
  return series;
});

const currentStatePath = computed<string>(() =>
  currentStateSeries.value
    .map((s, i) => {
      const px = x.value(s.index);
      const py = y.value(s.balance);
      return i === 0 ? `M${px},${py}` : `L${px},${py}`;
    })
    .join(' '),
);

/**
 * Alternating-year background bands. Every other year gets a subtle
 * paper-sunk tint so the eye can count decades without grid lines.
 */
const yearBands = computed(() => {
  const rows = props.computation.ledger;
  const bands: { x0: number; x1: number; year: number; shaded: boolean }[] = [];
  if (!rows.length) return bands;
  let yearStart = 0;
  let currentYear = Number(rows[0]!.date.slice(0, 4));
  for (let i = 1; i <= rows.length; i += 1) {
    const year = i < rows.length ? Number(rows[i]!.date.slice(0, 4)) : currentYear + 1;
    if (year !== currentYear) {
      bands.push({
        x0: x.value(yearStart),
        x1: x.value(i - 1) + (x.value(1) - x.value(0)) / 2,
        year: currentYear,
        shaded: currentYear % 2 === 0,
      });
      currentYear = year;
      yearStart = i;
    }
  }
  return bands;
});

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

const crossoverX = computed(() => {
  if (store.crossoverPeriod === null) return null;
  return x.value(store.crossoverPeriod - 1);
});

const hoverPoint = computed(() => {
  if (store.selectedPeriod != null) {
    const hit = points.value[store.selectedPeriod - 1];
    if (hit) return hit;
  }
  // Fallback: last past row. Keeps the tooltip populated on mobile where
  // there's no hover, and before the selection is seeded on mount.
  for (let i = points.value.length - 1; i >= 0; i -= 1) {
    if (points.value[i]!.date <= today.value) return points.value[i]!;
  }
  return points.value[0] ?? null;
});

const isHoverFuture = computed(() => {
  if (!hoverPoint.value) return false;
  return hoverPoint.value.date > today.value;
});

/** Projected balance on the "current pace" line at the hovered period. */
const currentStateAtHover = computed<number | null>(() => {
  if (!hoverPoint.value) return null;
  const idx = hoverPoint.value.x;
  const entry = currentStateSeries.value.find((s) => s.index === idx);
  return entry?.balance ?? null;
});

/** Scenario balances at the hovered period, keyed by scenario id. */
const scenariosAtHover = computed<{ id: string; name: string; balance: number; color: string }[]>(
  () => {
    if (!hoverPoint.value || !props.scenarios) return [];
    const idx = hoverPoint.value.x;
    const defs = store.activeLoan.scenarios ?? [];
    const out: { id: string; name: string; balance: number; color: string }[] = [];
    let i = 0;
    for (const [id, ev] of props.scenarios) {
      const row = ev.scenario.ledger[idx];
      if (row) {
        out.push({
          id,
          name: defs.find((s) => s.id === id)?.name ?? id,
          balance: row.actual?.balance_after ?? row.scheduled.balance_after,
          color: chartPalette.scenarios[i % chartPalette.scenarios.length]!,
        });
      }
      i += 1;
    }
    return out;
  },
);

function onMove(event: MouseEvent) {
  const svg = event.currentTarget as SVGSVGElement;
  const rect = svg.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * width;
  const relX = px - chartMargin.left;
  if (relX < 0 || relX > plotW) {
    store.setSelectedPeriod(null);
    return;
  }
  const [dMin, dMax] = domainX.value;
  const domX = (relX / plotW) * (dMax - dMin) + dMin;
  const idx = Math.round(domX);
  const clamped = Math.max(0, Math.min(points.value.length - 1, idx));
  store.setSelectedPeriod(clamped + 1);
}

function onLeave() {
  // Intentionally do not clear selectedPeriod — we want the last-hovered row
  // and scroll position to stay put when the mouse leaves the chart.
}

// Default the selection to the current (today) period so the tooltip shows
// meaningful numbers on first render — especially on mobile where there's no
// hover to seed it. Re-seeds whenever the ledger length changes (new file
// loaded) and the existing selection would point to a nonexistent row.
function seedSelectionAtToday() {
  const rows = props.computation.ledger;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]!.date <= today.value) {
      store.setSelectedPeriod(rows[i]!.period);
      return;
    }
  }
}

onMounted(() => {
  if (store.selectedPeriod == null) seedSelectionAtToday();
});

watch(
  () => props.computation.ledger.length,
  () => {
    const period = store.selectedPeriod;
    if (period == null || period > props.computation.ledger.length) {
      seedSelectionAtToday();
    }
  },
);
</script>

<template>
  <figure class="chart">
    <figcaption class="label">Balance over time</figcaption>
    <div v-if="hoverPoint" class="chart-tooltip">
      <p class="chart-tooltip__date">{{ formatMonthLabel(hoverPoint.date) }}</p>
      <dl>
        <div>
          <dt>Scheduled</dt>
          <dd>{{ formatShortCurrency(hoverPoint.scheduled, props.currency) }}</dd>
        </div>
        <div v-if="hoverPoint.actual !== undefined">
          <dt>Actual</dt>
          <dd>{{ formatShortCurrency(hoverPoint.actual, props.currency) }}</dd>
        </div>
        <div v-if="isHoverFuture && currentStateAtHover !== null">
          <dt>Current pace</dt>
          <dd>{{ formatShortCurrency(currentStateAtHover, props.currency) }}</dd>
        </div>
        <div v-for="scen in scenariosAtHover" :key="scen.id">
          <dt>{{ scen.name }}</dt>
          <dd>{{ formatShortCurrency(scen.balance, props.currency) }}</dd>
        </div>
      </dl>
    </div>
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      role="img"
      aria-label="Loan balance over time"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <g :transform="`translate(${chartMargin.left}, ${chartMargin.top})`">
        <!-- Alternating year bands: subtle paper-sunk tint behind even years -->
        <g class="year-bands">
          <rect
            v-for="band in yearBands"
            v-show="band.shaded"
            :key="band.year"
            :x="band.x0"
            :y="0"
            :width="Math.max(0, band.x1 - band.x0)"
            :height="plotH"
            fill="var(--ll-paper-sunk)"
            fill-opacity="0.55"
          />
        </g>

        <!-- Y-axis ticks (text only, no grid lines per style guide) -->
        <g class="axis">
          <text
            v-for="tick in yTicks"
            :key="`y-${tick}`"
            :x="-8"
            :y="y(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            class="tick"
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
            class="tick"
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
        <text :x="todayX + 4" :y="10" class="annotation">today</text>

        <!-- Crossover annotation: where scheduled principal ≥ scheduled interest -->
        <g v-if="crossoverX !== null">
          <line
            :x1="crossoverX"
            :x2="crossoverX"
            :y1="0"
            :y2="plotH"
            stroke="var(--ll-mark)"
            stroke-width="1"
            stroke-dasharray="3 3"
            stroke-opacity="0.55"
          />
          <text
            :x="crossoverX + 4"
            :y="10"
            class="annotation crossover-label"
            fill="var(--ll-mark)"
          >
            crossover
          </text>
        </g>

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
        <!-- Current-state projection: dashed Marigold forward from today -->
        <path
          :d="currentStatePath"
          fill="none"
          :stroke="chartPalette.actual.stroke"
          stroke-opacity="0.85"
          :stroke-width="chartPalette.actual.width"
          :stroke-dasharray="chartPalette.projection.dash"
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
            v-if="currentStateAtHover !== null"
            :cx="x(hoverPoint.x)"
            :cy="y(currentStateAtHover)"
            r="3"
            :fill="chartPalette.actual.stroke"
            fill-opacity="0.85"
          />
          <circle
            :cx="x(hoverPoint.x)"
            :cy="y(hoverPoint.scheduled)"
            r="2.5"
            :fill="chartPalette.scheduled.stroke"
            :fill-opacity="chartPalette.scheduled.opacity"
          />
          <circle
            v-for="scen in scenariosAtHover"
            :key="scen.id"
            :cx="x(hoverPoint.x)"
            :cy="y(scen.balance)"
            r="3"
            :fill="scen.color"
            fill-opacity="0.85"
          />
        </g>
      </g>
    </svg>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
  position: relative;
  display: flex;
  flex-direction: column;
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
  cursor: crosshair;
}

.tick {
  font-family: var(--ll-font-sans);
  font-size: 0.5rem;
  fill: var(--ll-ink-muted);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.annotation {
  font-family: var(--ll-font-serif);
  font-size: 0.6875rem;
  font-style: italic;
  fill: var(--ll-ink-muted);
}

@media (width < 900px) {
  .tick {
    font-size: 0.75rem;
  }

  .annotation {
    font-size: 0.875rem;
  }
}

/*
 * `.chart-tooltip` (not `.tooltip`) so it doesn't collide with Nextcloud's
 * own `.tooltip` class which forces `opacity: 0` on a sibling tooltip
 * pattern.
 */
.chart-tooltip {
  position: absolute;
  top: 2rem;
  right: 1rem;
  background: var(--ll-paper-raised);
  padding: 0.75rem 1rem;
  min-width: 160px;
  box-shadow: 0 2px 8px rgb(var(--ll-shadow-rgb) / 6%);
  pointer-events: none;
  font-family: var(--ll-font-sans);

  /*
   * Pin line-height so the tooltip doesn't grow when the host (Nextcloud)
   * sets `:root { line-height: 1.5 }`. Standalone uses browser-default
   * 1.2 — without this, the same tooltip renders visibly taller in NC.
   */
  line-height: 1.3;
}

/* On narrow viewports the tooltip sits *above* the chart instead of overlaying
  it, the DOM already has it between the caption and the SVG, so switching
  to static positioning is enough. */
@media (width < 900px) {
  .chart-tooltip {
    position: static;
    min-width: 0;
    margin: 0 0 0.5rem;
    padding: 0.5rem 0.75rem;
    box-shadow: none;
    background: var(--ll-paper-sunk);
  }

  .chart-tooltip dl {
    grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
    gap: 0.375rem 0.75rem;
  }

  .chart-tooltip div {
    align-items: flex-start;
    gap: 0;
  }

  .chart-tooltip__date {
    font-size: 0.8125rem;
    margin: 0 0 0.25rem;
  }
}

.chart-tooltip__date {
  font-family: var(--ll-font-serif);
  font-size: 0.875rem;
  margin: 0 0 0.5rem;
  color: var(--ll-ink);
}

.chart-tooltip dl {
  margin: 0;
  display: grid;
  gap: 0.25rem;
}

.chart-tooltip div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.chart-tooltip dt {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
  letter-spacing: 0.04em;
}

.chart-tooltip dd {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.crossover-label {
  font-size: 10px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
