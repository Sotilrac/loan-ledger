<script setup lang="ts">
import { computed } from 'vue';
import { DEMO_LOAN, computeLoan } from '@loan-ledger/core';

const computation = computed(() => computeLoan(DEMO_LOAN));

const fmtMoney = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: DEMO_LOAN.property.currency,
    maximumFractionDigits: 0,
  }).format(n);

const fmtMoneyCents = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: DEMO_LOAN.property.currency,
  }).format(n);

const fmtPercent = (n: number): string => `${(n * 100).toFixed(3)}%`;
</script>

<template>
  <main>
    <header>
      <p class="eyebrow">Demo Ledger</p>
      <h1>{{ DEMO_LOAN.property.name }}</h1>
    </header>

    <section class="hero">
      <div class="hero-block">
        <p class="label">Equity</p>
        <p class="hero-number">
          {{ computation.summary.equity != null ? fmtMoney(computation.summary.equity) : '—' }}
        </p>
      </div>
      <div class="hero-block">
        <p class="label">Current balance</p>
        <p class="supporting">
          {{ fmtMoney(computation.summary.current_actual_balance) }}
        </p>
        <p class="caption">
          Scheduled: {{ fmtMoney(computation.summary.current_scheduled_balance) }}
        </p>
      </div>
      <div class="hero-block">
        <p class="label">Interest paid</p>
        <p class="supporting">
          {{ fmtMoney(computation.summary.actual_interest_to_date) }}
        </p>
        <p class="caption">Over {{ computation.summary.payments_made }} payments</p>
      </div>
    </section>

    <section>
      <p class="label">Loan terms</p>
      <dl class="terms">
        <div>
          <dt>Original principal</dt>
          <dd>{{ fmtMoney(DEMO_LOAN.loan.principal) }}</dd>
        </div>
        <div>
          <dt>Term</dt>
          <dd>{{ DEMO_LOAN.loan.term_months }} months</dd>
        </div>
        <div>
          <dt>Current rate</dt>
          <dd>
            {{ fmtPercent(computation.ledger[computation.summary.payments_made - 1]?.rate ?? 0) }}
          </dd>
        </div>
        <div>
          <dt>Scheduled payoff</dt>
          <dd>{{ computation.summary.scheduled_payoff_date }}</dd>
        </div>
        <div>
          <dt>Projected payoff</dt>
          <dd>{{ computation.summary.projected_payoff_date }}</dd>
        </div>
        <div>
          <dt>Months ahead</dt>
          <dd>{{ computation.summary.months_ahead_of_schedule }}</dd>
        </div>
      </dl>
    </section>

    <section>
      <p class="label">Most recent payments</p>
      <table class="amort">
        <thead>
          <tr>
            <th>Date</th>
            <th class="num">Payment</th>
            <th class="num">Interest</th>
            <th class="num">Principal</th>
            <th class="num">Extra</th>
            <th class="num">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in computation.ledger
              .filter((r) => r.actual)
              .slice(-10)
              .reverse()"
            :key="row.period"
            class="actual-row"
          >
            <td>{{ row.date }}</td>
            <td class="num">{{ fmtMoneyCents(row.actual!.amount) }}</td>
            <td class="num">{{ fmtMoneyCents(row.actual!.interest) }}</td>
            <td class="num">{{ fmtMoneyCents(row.actual!.principal) }}</td>
            <td class="num">{{ row.actual!.extra ? fmtMoneyCents(row.actual!.extra) : '—' }}</td>
            <td class="num">{{ fmtMoneyCents(row.actual!.balance_after) }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <footer>
      <p class="caption">
        Showing demo data. To open your own <code>.loan.yaml</code>, wait for Phase 4.
      </p>
    </footer>
  </main>
</template>

<style scoped>
main {
  max-width: 1120px;
  margin: 0 auto;
  padding: 3rem clamp(1rem, 2vw, 2rem);
  color: var(--ll-ink);
  font-family: var(--ll-font-sans);
}

header {
  margin-bottom: 3rem;
}

h1 {
  font-family: var(--ll-font-serif);
  font-size: 1.953rem;
  font-weight: 500;
  margin: 0;
}

.eyebrow,
.label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0 0 0.5rem;
}

.hero {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 3rem;
  padding: 2rem 0 3rem;
  border-bottom: 1px solid var(--ll-ink-faint);
  margin-bottom: 3rem;
}

.hero-block {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.hero-number {
  font-family: var(--ll-font-serif);
  font-size: 3.052rem;
  font-weight: 400;
  color: var(--ll-accent);
  line-height: 1;
  margin: 0;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.supporting {
  font-family: var(--ll-font-sans);
  font-size: 1.5625rem;
  font-weight: 500;
  margin: 0;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.caption {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
  margin: 0;
}

section {
  margin-bottom: 3rem;
}

.terms {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin: 0;
}

.terms div {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.terms dt {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
}

.terms dd {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 500;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.amort {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.amort th {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  text-align: left;
  padding: 0.75rem 0.5rem;
  border-bottom: 1px solid var(--ll-ink-faint);
}

.amort td {
  padding: 0.75rem 0.5rem;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.amort tbody tr:nth-child(even) {
  background: var(--ll-paper-sunk);
}

.amort .num {
  text-align: right;
}

.actual-row td:first-child {
  border-left: 2px solid var(--ll-mark);
  padding-left: 0.75rem;
}

footer {
  margin-top: 4rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--ll-ink-faint);
}

code {
  font-family: var(--ll-font-mono);
  font-size: 0.875rem;
  background: var(--ll-paper-sunk);
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
}
</style>
