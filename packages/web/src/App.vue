<script setup lang="ts">
import { computed } from 'vue';
import BalanceChart from './charts/BalanceChart.vue';
import CompositionChart from './charts/CompositionChart.vue';
import EquityGauge from './charts/EquityGauge.vue';
import AmortizationTable from './components/AmortizationTable.vue';
import FilePicker from './components/FilePicker.vue';
import LoanEditForm from './components/LoanEditForm.vue';
import { useLoanStore } from './stores/loan.js';

const store = useLoanStore();

const currency = computed(() => store.activeLoan.property.currency);

const fmtCents = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.value,
  }).format(n);

const fmtPercent = (n: number): string => `${(n * 100).toFixed(3)}%`;

const currentRateDisplay = computed(() => {
  const madeRows = store.computation.ledger.filter((r) => r.actual);
  const last = madeRows[madeRows.length - 1];
  return fmtPercent(last?.rate ?? store.activeLoan.loan.annual_rate);
});

const sourceLabel = computed(() => {
  if (store.source === 'demo') return 'Demo data';
  if (store.source === 'fsa') return `${store.fileName} · will save in place`;
  return `${store.fileName} · saves as download`;
});

async function onSave() {
  await store.save();
}
</script>

<template>
  <main>
    <header class="site-header">
      <div>
        <p class="eyebrow">Loan Ledger</p>
        <h1>{{ store.activeLoan.property.name }}</h1>
        <p class="source caption">
          {{ sourceLabel
          }}<span v-if="store.hasUnsavedChanges" class="dirty">· unsaved changes</span>
        </p>
      </div>
      <div class="controls">
        <FilePicker />
        <button v-if="!store.isEditing" class="secondary" type="button" @click="store.startEditing">
          Edit loan
        </button>
        <template v-else>
          <button class="primary" type="button" @click="store.commitEditing">Done editing</button>
          <button class="tertiary" type="button" @click="store.cancelEditing">Cancel</button>
        </template>
        <button
          v-if="store.hasUnsavedChanges && !store.isEditing"
          class="primary"
          type="button"
          :disabled="store.saveState === 'saving'"
          @click="onSave"
        >
          {{ store.canWriteToFile ? 'Save to file' : 'Download YAML' }}
        </button>
      </div>
    </header>

    <div v-if="store.validationErrors.length" class="banner error-banner">
      <p>File failed validation. Showing last good state.</p>
      <ul>
        <li v-for="(err, i) in store.validationErrors.slice(0, 3)" :key="i">
          <code>{{ err.path }}</code> — {{ err.message }}
        </li>
      </ul>
    </div>
    <div v-else-if="store.saveError" class="banner error-banner">
      <p>Save failed: {{ store.saveError }}</p>
    </div>

    <LoanEditForm v-if="store.isEditing" />

    <section class="summary">
      <div class="summary-gauge">
        <EquityGauge
          :equity="store.computation.summary.equity ?? 0"
          :property-value="store.activeLoan.valuation.current.amount"
          :currency="currency"
        />
      </div>
      <div class="summary-facts">
        <div>
          <p class="label">Current balance</p>
          <p class="supporting">
            {{ fmtCents(store.computation.summary.current_actual_balance) }}
          </p>
          <p class="caption">
            Scheduled would be
            {{ fmtCents(store.computation.summary.current_scheduled_balance) }}
          </p>
        </div>
        <div>
          <p class="label">Interest paid</p>
          <p class="supporting">
            {{ fmtCents(store.computation.summary.actual_interest_to_date) }}
          </p>
          <p class="caption">Over {{ store.computation.summary.payments_made }} payments</p>
        </div>
        <div>
          <p class="label">Current rate</p>
          <p class="supporting">{{ currentRateDisplay }}</p>
          <p class="caption">
            Payoff projected {{ store.computation.summary.projected_payoff_date }}
          </p>
        </div>
        <div v-if="store.computation.summary.months_ahead_of_schedule > 0">
          <p class="label">Ahead of schedule</p>
          <p class="supporting">{{ store.computation.summary.months_ahead_of_schedule }} months</p>
          <p class="caption readout">
            <em>That's how far your extras have pulled your balance forward.</em>
          </p>
        </div>
      </div>
    </section>

    <section class="layout">
      <div class="layout-main">
        <BalanceChart
          :computation="store.computation"
          :scenarios="store.scenarios"
          :today="store.today"
          :currency="currency"
        />
        <CompositionChart
          :computation="store.computation"
          :today="store.today"
          :currency="currency"
        />
        <AmortizationTable :computation="store.computation" :currency="currency" />
      </div>

      <aside class="scenarios">
        <p class="label">Scenarios</p>
        <p class="readout"><em>What happens if you try something different?</em></p>

        <ul v-if="(store.activeLoan.scenarios ?? []).length">
          <li v-for="scenario in store.activeLoan.scenarios ?? []" :key="scenario.id">
            <div class="scenario-card">
              <p class="scenario-name">{{ scenario.name }}</p>
              <p v-if="scenario.description" class="scenario-desc">
                {{ scenario.description }}
              </p>
              <dl v-if="store.scenarios.get(scenario.id)" class="delta">
                <div
                  :class="{
                    positive: store.scenarios.get(scenario.id)!.delta.interest_saved > 0,
                    negative: store.scenarios.get(scenario.id)!.delta.interest_saved < 0,
                  }"
                >
                  <dt>Interest delta</dt>
                  <dd>
                    {{ fmtCents(store.scenarios.get(scenario.id)!.delta.interest_saved) }}
                  </dd>
                </div>
                <div
                  :class="{
                    positive: store.scenarios.get(scenario.id)!.delta.months_sooner > 0,
                    negative: store.scenarios.get(scenario.id)!.delta.months_sooner < 0,
                  }"
                >
                  <dt>Payoff sooner</dt>
                  <dd>{{ store.scenarios.get(scenario.id)!.delta.months_sooner }} months</dd>
                </div>
              </dl>
            </div>
          </li>
        </ul>
        <p v-else class="readout empty"><em>No scenarios defined yet.</em></p>
      </aside>
    </section>
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

.site-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  margin-bottom: 2rem;
  flex-wrap: wrap;
}

h1 {
  font-family: var(--ll-font-serif);
  font-size: 1.953rem;
  font-weight: 500;
  margin: 0;
}

.source {
  margin-top: 0.25rem;
}

.dirty {
  color: var(--ll-mark);
  margin-left: 0.5rem;
}

.controls {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

button {
  font-family: var(--ll-font-sans);
  font-size: 0.875rem;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition:
    background 120ms,
    border-color 120ms;
}

.primary {
  background: var(--ll-accent);
  color: #fff;
  border: none;
}

.primary:hover:not(:disabled) {
  background: var(--ll-accent-hover);
}

.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.secondary {
  background: transparent;
  color: var(--ll-ink);
  border: 1px solid var(--ll-ink-faint);
}

.secondary:hover {
  border-color: var(--ll-ink);
}

.tertiary {
  background: transparent;
  color: var(--ll-ink-muted);
  border: none;
}

.tertiary:hover {
  color: var(--ll-ink);
  text-decoration: underline;
}

.banner {
  padding: 1rem 1.25rem;
  border-radius: 4px;
  margin-bottom: 2rem;
  font-size: 0.875rem;
}

.banner ul {
  margin: 0.5rem 0 0;
  padding: 0 0 0 1.25rem;
}

.banner code {
  font-family: var(--ll-font-mono);
  font-size: 0.8125rem;
}

.error-banner {
  background: var(--ll-negative-soft);
  color: var(--ll-negative);
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

.readout.empty {
  font-size: 1rem;
  color: var(--ll-ink-muted);
}

.summary {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 3rem;
  align-items: center;
  padding: 2rem 0 3rem;
  border-top: 1px solid var(--ll-ink-faint);
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

.scenario-card {
  background: var(--ll-paper-sunk);
  border-radius: 4px;
  padding: 1rem 1.25rem;
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
