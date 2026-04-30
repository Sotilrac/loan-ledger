<script setup lang="ts">
import type { LedgerRow, LoanComputation } from '@loan-ledger/core';
import { PhPencilSimple } from '@phosphor-icons/vue';
import { computed, ref, watch } from 'vue';
import { formatMonthOnly } from '../charts/scale.js';
import { fmtCents, fmtPercent } from '../format.js';
import { useLoanStore } from '../stores/loan.js';
import PaymentEditorRow from './PaymentEditorRow.vue';

const props = defineProps<{
  computation: LoanComputation;
  currency?: string;
}>();

const store = useLoanStore();
const scrollEl = ref<HTMLElement | null>(null);

const fmtMoney = (n: number): string => fmtCents(n, props.currency ?? 'USD');
const fmtRate = fmtPercent;

const rows = computed(() => props.computation.ledger);

interface YearGroup {
  year: string;
  rows: Array<{ row: LedgerRow; idx: number }>;
}

const yearGroups = computed<YearGroup[]>(() => {
  const groups: YearGroup[] = [];
  props.computation.ledger.forEach((row, idx) => {
    const year = row.date.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.rows.push({ row, idx });
    } else {
      groups.push({ year, rows: [{ row, idx }] });
    }
  });
  return groups;
});

/**
 * Max total payment across all rows — used to scale per-row composition bars.
 * Larger payments fill more of the column; smaller payments look proportionally
 * shorter, so a rate-change step is visually obvious.
 */
const maxTotal = computed(() => {
  let m = 0;
  for (const r of rows.value) {
    const total =
      (r.actual?.amount ?? r.scheduled.payment + r.scheduled.escrow) +
      (r.actual?.extra ?? r.scheduled.extra ?? 0);
    if (total > m) m = total;
  }
  return m || 1;
});

interface Segments {
  principal: number;
  interest: number;
  escrow: number;
  extra: number;
  total: number;
}

function segmentsFor(row: LedgerRow): Segments {
  const actual = row.actual;
  const principal = actual?.principal ?? row.scheduled.principal;
  const interest = actual?.interest ?? row.scheduled.interest;
  const escrow = actual?.escrow ?? row.scheduled.escrow;
  const extra = actual?.extra ?? row.scheduled.extra ?? 0;
  return { principal, interest, escrow, extra, total: principal + interest + escrow + extra };
}

function barWidthPct(row: LedgerRow): string {
  const { total } = segmentsFor(row);
  return `${(total / maxTotal.value) * 100}%`;
}

function barTooltip(row: LedgerRow): string {
  const s = segmentsFor(row);
  if (s.total <= 0) return '';
  const pct = (v: number): string => `${((v / s.total) * 100).toFixed(1)}%`;
  const lines = [
    `Total ${fmtMoney(s.total)}`,
    `Principal ${fmtMoney(s.principal)} (${pct(s.principal)})`,
    `Interest ${fmtMoney(s.interest)} (${pct(s.interest)})`,
  ];
  if (s.escrow > 0) lines.push(`Escrow ${fmtMoney(s.escrow)} (${pct(s.escrow)})`);
  if (s.extra > 0) lines.push(`Extra ${fmtMoney(s.extra)} (${pct(s.extra)})`);
  return lines.join('\n');
}

function rowClass(row: LedgerRow): Record<string, boolean> {
  const isPast = row.date <= store.today;
  return {
    'actual-row': !!row.actual,
    projected: !row.actual && !isPast,
    selected: row.period === store.selectedPeriod,
  };
}

function onHover(period: number | null) {
  // Ignore the null case — we only *update* the selection on enter, not on
  // leave. That keeps the selection (and scroll) where it was after the
  // mouse drifts off both the table and the chart.
  if (period != null) store.setSelectedPeriod(period);
}

function tableScrollsInternally(): boolean {
  // On narrow viewports the amortization table is laid out full-length and the
  // page scrolls as a whole. In that mode we don't want auto-scroll-on-hover
  // yanking the page around.
  if (typeof window === 'undefined') return true;
  return window.innerWidth >= 900;
}

watch(
  () => store.selectedPeriod,
  (period) => {
    if (period == null || !scrollEl.value || !tableScrollsInternally()) return;
    const row = scrollEl.value.querySelector(`[data-period="${period}"]`);
    if (row && typeof (row as Element).scrollIntoView === 'function') {
      (row as Element).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },
);

watch(
  () => [props.computation.ledger.length, store.today],
  () => {
    requestAnimationFrame(() => {
      if (!scrollEl.value || !tableScrollsInternally()) return;
      const todayRow = scrollEl.value.querySelector('.today-marker');
      if (todayRow && typeof (todayRow as Element).scrollIntoView === 'function') {
        (todayRow as Element).scrollIntoView({ block: 'center' });
      }
    });
  },
  { immediate: true, flush: 'post' },
);

function showsTodayMarker(row: LedgerRow, idx: number): boolean {
  const prev = props.computation.ledger[idx - 1];
  if (!prev) return row.date > store.today;
  return prev.date <= store.today && row.date > store.today;
}

function showsCrossoverMarker(row: LedgerRow): boolean {
  return store.crossoverPeriod !== null && row.period === store.crossoverPeriod;
}

// --- Payment inline editor --------------------------------------------------
// The editor UI itself lives in `PaymentEditorRow`; this component only
// tracks which date is currently being edited.

const editingDate = ref<string | null>(null);

function startEditPayment(row: LedgerRow) {
  editingDate.value = row.date;
}

function closeEditor() {
  editingDate.value = null;
}
</script>

<template>
  <figure class="table-wrap">
    <div class="caption-row">
      <p class="label">Amortization</p>
      <ul class="legend">
        <li
          data-tooltip="The portion of each payment that goes toward reducing the loan balance — your equity."
        >
          <span class="swatch principal" /> <span class="term">Principal</span>
        </li>
        <li data-tooltip="The cost of borrowing. Paid to the lender; does not reduce the balance.">
          <span class="swatch interest" /> <span class="term">Interest</span>
        </li>
        <li
          data-tooltip="A separate amount collected monthly and held by the lender to pay property taxes and homeowners insurance on your behalf."
        >
          <span class="swatch escrow" /> <span class="term">Escrow</span>
        </li>
        <li
          data-tooltip="Any additional amount paid beyond the scheduled payment. Applied entirely to principal, so it accelerates payoff."
        >
          <span class="swatch extra" /> <span class="term">Extra</span>
        </li>
      </ul>
    </div>
    <div ref="scrollEl" class="scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>#</th>
            <th class="num">Rate</th>
            <th class="num">Payment</th>
            <th class="num">Interest</th>
            <th class="num">Principal</th>
            <th class="num">Balance</th>
            <th class="bar-col">Composition</th>
          </tr>
        </thead>
        <tbody v-for="group in yearGroups" :key="group.year">
          <tr class="year-divider">
            <td colspan="8">
              <span>{{ group.year }}</span>
            </td>
          </tr>
          <template v-for="{ row, idx } in group.rows" :key="row.period">
            <tr v-if="showsTodayMarker(row, idx)" class="today-marker">
              <td colspan="8"><span>today</span></td>
            </tr>
            <tr v-if="showsCrossoverMarker(row)" class="crossover-marker">
              <td colspan="8"><span>crossover · principal ≥ interest</span></td>
            </tr>
            <tr
              :data-period="row.period"
              :class="rowClass(row)"
              @mouseenter="onHover(row.period)"
              @mouseleave="onHover(null)"
            >
              <td class="date-cell">
                <span class="date-text">{{ formatMonthOnly(row.date) }}</span>
                <button
                  type="button"
                  class="row-edit-btn"
                  :aria-label="`Edit ${row.date}`"
                  :data-tooltip="row.actual ? 'Edit payment' : 'Add payment for this month'"
                  @click.stop="startEditPayment(row)"
                >
                  <PhPencilSimple :size="12" weight="regular" />
                </button>
              </td>
              <td class="period">{{ row.period }}</td>
              <td class="num">{{ fmtRate(row.rate) }}</td>
              <td class="num">
                {{ fmtMoney(row.actual?.amount ?? row.scheduled.payment + row.scheduled.escrow) }}
              </td>
              <td class="num">{{ fmtMoney(row.actual?.interest ?? row.scheduled.interest) }}</td>
              <td class="num">{{ fmtMoney(row.actual?.principal ?? row.scheduled.principal) }}</td>
              <td class="num">
                {{ fmtMoney(row.actual?.balance_after ?? row.scheduled.balance_after) }}
              </td>
              <td class="bar-col">
                <div class="bar-track" :data-tooltip="barTooltip(row)">
                  <div class="bar" :style="{ width: barWidthPct(row) }">
                    <span class="seg principal" :style="{ flex: segmentsFor(row).principal }" />
                    <span class="seg interest" :style="{ flex: segmentsFor(row).interest }" />
                    <span class="seg escrow" :style="{ flex: segmentsFor(row).escrow }" />
                    <span
                      v-if="segmentsFor(row).extra > 0"
                      class="seg extra"
                      :style="{ flex: segmentsFor(row).extra }"
                    />
                  </div>
                </div>
              </td>
            </tr>
            <PaymentEditorRow v-if="editingDate === row.date" :row="row" @close="closeEditor" />
          </template>
        </tbody>
      </table>
    </div>
  </figure>
</template>

<style scoped>
.table-wrap {
  margin: 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.caption-row {
  display: flex;
  align-items: baseline;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}

.label {
  font-family: var(--ll-font-sans);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin: 0 0 0 auto;
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
  cursor: help;
}

.legend .term {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--ll-ink-faint);
  text-underline-offset: 3px;
}

.swatch {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.swatch.principal,
.seg.principal {
  background: var(--ll-accent);
}

.swatch.interest,
.seg.interest {
  background: var(--ll-accent);
  opacity: 0.5;
}

.swatch.escrow,
.seg.escrow {
  background: var(--ll-ink-faint);
}

.swatch.extra,
.seg.extra {
  background: var(--ll-mark);
}

.scroll {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: 1px solid var(--ll-ink-faint);
}

@media (width < 900px) {
  .scroll {
    max-height: none;
    overflow-x: auto;
    border-bottom: none;
  }

  /* Let columns size to their content instead of the desktop fixed layout,
    and keep the table at least 800px wide so rows stay readable while the
    container scrolls horizontally. */
  table {
    table-layout: auto;
    min-width: 800px;
    width: max-content;
  }

  thead th:nth-child(1),
  thead th:nth-child(2),
  thead th:nth-child(3),
  thead th:nth-child(4),
  thead th:nth-child(5),
  thead th:nth-child(6),
  thead th:nth-child(7),
  thead th.bar-col {
    width: auto;
  }

  thead th.bar-col,
  tbody td.bar-col {
    min-width: 80px;
  }
}

@media (width < 520px) {
  table {
    font-size: 0.75rem;
  }

  thead th {
    font-size: 0.625rem;
    padding: 0.375rem 0.25rem;
  }

  tbody td {
    padding: 0.25rem;
  }
}

table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--ll-font-sans);
  font-size: 0.8125rem;
  table-layout: fixed;
}

thead {
  position: sticky;
  top: 0;
  background: var(--ll-paper);
  z-index: 2;
}

thead th {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid var(--ll-ink-faint);
  white-space: nowrap;
}

/* Column sizing. 8 columns total. */
thead th:nth-child(1) {
  width: 4.125rem;
}

thead th:nth-child(2) {
  width: 2rem;
  padding-left: 0.25rem;
  padding-right: 0.25rem;
  text-align: center;
}

thead th:nth-child(3) {
  width: 4.5rem;
}

thead th:nth-child(4),
thead th:nth-child(5),
thead th:nth-child(6),
thead th:nth-child(7) {
  width: auto;
}

thead th.bar-col {
  width: 28%;
}

tbody tr {
  transition: background 80ms;

  /* Enough to clear both the sticky thead (~2rem) and the sticky year header
    (~1.5rem) so scrollIntoView doesn't tuck the target under them. */
  scroll-margin-top: 3.55rem;
  scroll-margin-bottom: 8px;
}

tbody tr:nth-child(even) {
  background: var(--ll-paper-sunk);
}

tbody td {
  padding: 0.375rem 0.5rem;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.num {
  text-align: right;
  white-space: nowrap;
}

.period {
  color: var(--ll-ink-muted);
  font-size: 0.75rem;
  text-align: center;
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}

.actual-row td:first-child {
  border-left: 2px solid var(--ll-mark);
  padding-left: calc(0.5rem - 2px);
}

.projected td:first-child {
  padding-left: 0.5rem;
}

.projected td {
  color: var(--ll-ink-soft);
  font-style: italic;
}

tbody tr.selected {
  background: var(--ll-accent-soft) !important;
}

.projected .bar {
  opacity: 0.6;
}

.year-divider td,
.today-marker td,
.crossover-marker td {
  padding: 0.2rem 0.5rem;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: none;
  background: var(--ll-paper) !important;
}

.year-divider td {
  position: sticky;
  top: 2rem;
  z-index: 1;
}

.year-divider span {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.today-marker span {
  font-family: var(--ll-font-serif);
  font-style: italic;
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
}

.crossover-marker span {
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-mark);
}

/* Row edit icon */
.date-cell {
  position: relative;
  white-space: nowrap;
}

.row-edit-btn {
  opacity: 0;
  background: transparent;
  border: none;
  padding: 0.125rem;
  margin-left: 0.25rem;
  color: var(--ll-ink-muted);
  cursor: pointer;
  vertical-align: middle;
  line-height: 0;
  transition:
    opacity 80ms,
    color 80ms;
}

tbody tr:hover .row-edit-btn,
tbody tr.selected .row-edit-btn {
  opacity: 1;
}

.row-edit-btn:hover {
  color: var(--ll-accent);
}

/* Per-row composition bar */
.bar-col {
  padding: 0.25rem 0.5rem !important;
}

.bar-track {
  width: 100%;
  height: 10px;
  background: transparent;
}

.bar {
  display: flex;
  height: 100%;
  border-radius: 2px;
  overflow: hidden;
}

.seg {
  height: 100%;
  min-width: 0;
}
</style>
