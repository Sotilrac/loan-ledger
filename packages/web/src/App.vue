<script setup lang="ts">
import { DEMO_LOAN, computeLoan, evaluateAllScenarios, todayISO } from '@loan-ledger/core';
import { computed, ref } from 'vue';
import BalanceChart from './charts/BalanceChart.vue';
import CompositionChart from './charts/CompositionChart.vue';
import EquityGauge from './charts/EquityGauge.vue';

const today = todayISO();

const computation = computed(() => computeLoan(DEMO_LOAN, { today }));
const allScenarios = computed(() => evaluateAllScenarios(DEMO_LOAN, { today }));

const activeScenarioId = ref<string | null>(null);
const activeScenarios = computed(() => {
  if (!activeScenarioId.value) return new Map();
  const evalResult = allScenarios.value.get(activeScenarioId.value);
  if (!evalResult) return new Map();
  return new Map([[activeScenarioId.value, evalResult]]);
});

const currency = computed(() => DEMO_LOAN.property.currency);

const fmtCents = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.value,
  }).format(n);

const fmtPercent = (n: number): string => `${(n * 100).toFixed(3)}%`;

const currentRateDisplay = computed(() => {
  const madeRows = computation.value.ledger.filter((r) => r.actual);
  const last = madeRows[madeRows.length - 1];
  return fmtPercent(last?.rate ?? DEMO_LOAN.loan.annual_rate);
});

function toggleScenario(id: string) {
  activeScenarioId.value = activeScenarioId.value === id ? null : id;
}
</script>

<template>
  <main>
    <header>
      <p class="eyebrow">Demo Ledger</p>
      <h1>{{ DEMO_LOAN.property.name }}</h1>
    </header>

    <section class="summary">
      <div class="summary-gauge">
        <EquityGauge
          :equity="computation.summary.equity ?? 0"
          :property-value="DEMO_LOAN.valuation.current.amount"
          :currency="currency"
        />
      </div>
      <div class="summary-facts">
        <div>
          <p class="label">Current balance</p>
          <p class="supporting">{{ fmtCents(computation.summary.current_actual_balance) }}</p>
          <p class="caption">
            Scheduled would be {{ fmtCents(computation.summary.current_scheduled_balance) }}
          </p>
        </div>
        <div>
          <p class="label">Interest paid</p>
          <p class="supporting">{{ fmtCents(computation.summary.actual_interest_to_date) }}</p>
          <p class="caption">Over {{ computation.summary.payments_made }} payments</p>
        </div>
        <div>
          <p class="label">Current rate</p>
          <p class="supporting">{{ currentRateDisplay }}</p>
          <p class="caption">Payoff projected {{ computation.summary.projected_payoff_date }}</p>
        </div>
        <div v-if="computation.summary.months_ahead_of_schedule > 0">
          <p class="label">Ahead of schedule</p>
          <p class="supporting">{{ computation.summary.months_ahead_of_schedule }} months</p>
          <p class="caption readout">
            <em>That's how far your extras have pulled your balance forward.</em>
          </p>
        </div>
      </div>
    </section>

    <section class="layout">
      <div class="layout-main">
        <BalanceChart
          :computation="computation"
          :scenarios="activeScenarios"
          :today="today"
          :currency="currency"
        />
        <CompositionChart :computation="computation" :today="today" :currency="currency" />
      </div>

      <aside class="scenarios">
        <p class="label">Scenarios</p>
        <p class="readout">
          <em>What happens if you try something different?</em>
        </p>

        <ul>
          <li
            v-for="scenario in DEMO_LOAN.scenarios ?? []"
            :key="scenario.id"
            :class="{ active: activeScenarioId === scenario.id }"
          >
            <button type="button" @click="toggleScenario(scenario.id)">
              <p class="scenario-name">{{ scenario.name }}</p>
              <p v-if="scenario.description" class="scenario-desc">
                {{ scenario.description }}
              </p>
              <dl v-if="allScenarios.get(scenario.id)" class="delta">
                <div
                  :class="{
                    positive: allScenarios.get(scenario.id)!.delta.interest_saved > 0,
                    negative: allScenarios.get(scenario.id)!.delta.interest_saved < 0,
                  }"
                >
                  <dt>Interest delta</dt>
                  <dd>
                    {{ fmtCents(allScenarios.get(scenario.id)!.delta.interest_saved) }}
                  </dd>
                </div>
                <div
                  :class="{
                    positive: allScenarios.get(scenario.id)!.delta.months_sooner > 0,
                    negative: allScenarios.get(scenario.id)!.delta.months_sooner < 0,
                  }"
                >
                  <dt>Payoff sooner</dt>
                  <dd>{{ allScenarios.get(scenario.id)!.delta.months_sooner }} months</dd>
                </div>
              </dl>
            </button>
          </li>
        </ul>
      </aside>
    </section>

    <footer>
      <p class="caption">Demo data. To open your own <code>.loan.yaml</code>, wait for Phase 4.</p>
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
  margin: 0.25rem 0 0;
}

.readout {
  font-family: var(--ll-font-serif);
  font-style: italic;
  font-size: 1.25rem;
  color: var(--ll-ink-soft);
  line-height: 1.4;
}

.summary {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 3rem;
  align-items: center;
  padding: 2rem 0 3rem;
  border-bottom: 1px solid var(--ll-ink-faint);
  margin-bottom: 3rem;
}

.summary-gauge {
  display: flex;
  justify-content: center;
}

.summary-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 2rem;
}

.layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 3rem;
}

.layout-main {
  display: flex;
  flex-direction: column;
  gap: 3rem;
}

.scenarios ul {
  list-style: none;
  padding: 0;
  margin: 1.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.scenarios li button {
  width: 100%;
  background: var(--ll-paper-sunk);
  border: none;
  border-left: 2px solid transparent;
  border-radius: 4px;
  padding: 1rem 1.25rem;
  text-align: left;
  cursor: pointer;
  color: var(--ll-ink);
  font-family: inherit;
  transition:
    border-color 120ms,
    background 120ms;
}

.scenarios li button:hover {
  border-left-color: var(--ll-ink-muted);
}

.scenarios li.active button {
  border-left-color: var(--ll-mark);
}

.scenario-name {
  font-family: var(--ll-font-serif);
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0;
}

.scenario-desc {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
  margin: 0.25rem 0 0.75rem;
  line-height: 1.4;
}

.delta {
  margin: 0;
  display: grid;
  gap: 0.25rem;
}

.delta div {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.delta dt {
  color: var(--ll-ink-muted);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
}

.delta dd {
  margin: 0;
  font-weight: 500;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.delta .positive dd {
  color: var(--ll-positive);
}

.delta .negative dd {
  color: var(--ll-negative);
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

@media (width <= 900px) {
  .summary {
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
