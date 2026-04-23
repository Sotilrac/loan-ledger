<script setup lang="ts">
import type { LedgerRow, LoanComputation } from '@loan-ledger/core';
import { computed, ref, watch } from 'vue';
import { formatMonthLabel } from '../charts/scale.js';
import { useLoanStore } from '../stores/loan.js';

const props = defineProps<{
  computation: LoanComputation;
  currency?: string;
}>();

const store = useLoanStore();
const tbody = ref<HTMLTableSectionElement | null>(null);

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.currency ?? 'USD',
  }).format(n);

const fmtRate = (n: number): string => `${(n * 100).toFixed(3)}%`;

const rows = computed(() => props.computation.ledger);

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

function rowClass(row: LedgerRow): Record<string, boolean> {
  const isPast = row.date <= store.today;
  return {
    'actual-row': !!row.actual,
    projected: !row.actual && !isPast,
    selected: row.period === store.selectedPeriod,
  };
}

function onHover(period: number | null) {
  store.setSelectedPeriod(period);
}

watch(
  () => store.selectedPeriod,
  (period) => {
    if (period == null || !tbody.value) return;
    const row = tbody.value.querySelector(`[data-period="${period}"]`);
    if (row && typeof (row as Element).scrollIntoView === 'function') {
      (row as Element).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  },
);

watch(
  () => [props.computation.ledger.length, store.today],
  () => {
    requestAnimationFrame(() => {
      if (!tbody.value) return;
      const todayRow = tbody.value.querySelector('.today-marker');
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

function showsYearDivider(row: LedgerRow, idx: number): boolean {
  if (idx === 0) return false;
  const prev = props.computation.ledger[idx - 1];
  if (!prev) return false;
  return prev.date.slice(0, 4) !== row.date.slice(0, 4);
}
</script>

<template>
  <figure class="table-wrap">
    <div class="caption-row">
      <p class="label">Amortization</p>
      <ul class="legend">
        <li
          title="The portion of each payment that goes toward reducing the loan balance — your equity."
        >
          <span class="swatch principal" /> <span class="term">Principal</span>
        </li>
        <li title="The cost of borrowing. Paid to the lender; does not reduce the balance.">
          <span class="swatch interest" /> <span class="term">Interest</span>
        </li>
        <li
          title="A separate amount collected monthly and held by the lender to pay property taxes and homeowners insurance on your behalf."
        >
          <span class="swatch escrow" /> <span class="term">Escrow</span>
        </li>
        <li
          title="Any additional amount paid beyond the scheduled payment. Applied entirely to principal, so it accelerates payoff."
        >
          <span class="swatch extra" /> <span class="term">Extra</span>
        </li>
      </ul>
    </div>
    <div class="scroll">
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
        <tbody ref="tbody">
          <template v-for="(row, idx) in rows" :key="row.period">
            <tr v-if="showsYearDivider(row, idx)" class="year-divider">
              <td colspan="8">
                <span>{{ row.date.slice(0, 4) }}</span>
              </td>
            </tr>
            <tr v-if="showsTodayMarker(row, idx)" class="today-marker">
              <td colspan="8"><span>today</span></td>
            </tr>
            <tr
              :data-period="row.period"
              :class="rowClass(row)"
              @mouseenter="onHover(row.period)"
              @mouseleave="onHover(null)"
            >
              <td>{{ formatMonthLabel(row.date) }}</td>
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
                <div class="bar-track">
                  <div
                    class="bar"
                    :style="{ width: barWidthPct(row) }"
                    :title="`Total ${fmtMoney(segmentsFor(row).total)}`"
                  >
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
  min-height: 0;
  height: 100%;
}

.caption-row {
  display: flex;
  justify-content: space-between;
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
  gap: 1.25rem;
  margin: 0;
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
  min-height: 0;
  overflow-y: auto;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: 1px solid var(--ll-ink-faint);
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
  z-index: 1;
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
  width: 5.5rem;
}

thead th:nth-child(2) {
  width: 2.5rem;
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
  scroll-margin-top: 40px;
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
.today-marker td {
  padding: 0.2rem 0.5rem;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: none;
  background: var(--ll-paper) !important;
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

/* Per-row composition bar */
.bar-col {
  padding: 0.25rem 0.5rem !important;
}

.bar-track {
  width: 100%;
  height: 10px;
  border-radius: 2px;
  overflow: hidden;
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
