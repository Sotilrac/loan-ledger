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

/**
 * Three views: past (actual paid), current-year marker, future (projected).
 * Keep them all rendered in one tbody; style differentiates.
 */
const rows = computed(() => props.computation.ledger);

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

// When selectedPeriod changes (from a chart), scroll that row into view.
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

// Scroll-to-today on initial mount so the user isn't staring at 2020 payments.
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
    <figcaption class="label">Amortization</figcaption>
    <div class="scroll">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Period</th>
            <th class="num">Rate</th>
            <th class="num">Payment</th>
            <th class="num">Interest</th>
            <th class="num">Principal</th>
            <th class="num">Escrow</th>
            <th class="num">Extra</th>
            <th class="num">Balance</th>
          </tr>
        </thead>
        <tbody ref="tbody">
          <template v-for="(row, idx) in rows" :key="row.period">
            <tr v-if="showsYearDivider(row, idx)" class="year-divider">
              <td colspan="9">
                <span>{{ row.date.slice(0, 4) }}</span>
              </td>
            </tr>
            <tr v-if="showsTodayMarker(row, idx)" class="today-marker">
              <td colspan="9"><span>today</span></td>
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
              <td class="num">{{ fmtMoney(row.actual?.escrow ?? row.scheduled.escrow) }}</td>
              <td class="num extra">
                {{ (row.actual?.extra ?? 0) > 0 ? fmtMoney(row.actual!.extra) : '' }}
              </td>
              <td class="num">
                {{ fmtMoney(row.actual?.balance_after ?? row.scheduled.balance_after) }}
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

.scroll {
  max-height: 520px;
  overflow-y: auto;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: 1px solid var(--ll-ink-faint);
}

table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--ll-font-sans);
  font-size: 0.875rem;
}

thead {
  position: sticky;
  top: 0;
  background: var(--ll-paper);
  z-index: 1;
}

thead th {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  text-align: left;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--ll-ink-faint);
  white-space: nowrap;
}

tbody tr {
  transition: background 80ms;
}

tbody tr:nth-child(even) {
  background: var(--ll-paper-sunk);
}

tbody td {
  padding: 0.5rem;
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

.extra {
  color: var(--ll-mark);
}

.year-divider td,
.today-marker td {
  padding: 0.25rem 0.5rem;
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
</style>
