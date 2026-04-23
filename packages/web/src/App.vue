<script setup lang="ts">
import { computed, ref } from 'vue';
import BalanceChart from './charts/BalanceChart.vue';
import EquityGauge from './charts/EquityGauge.vue';
import AmortizationTable from './components/AmortizationTable.vue';
import CsvImportDialog from './components/CsvImportDialog.vue';
import FilePicker from './components/FilePicker.vue';
import LoanEditForm from './components/LoanEditForm.vue';
import ValuationRefresh from './components/ValuationRefresh.vue';
import { useLoanStore } from './stores/loan.js';

const store = useLoanStore();
const importOpen = ref(false);

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
  <main class="app">
    <header class="site-header">
      <div class="title-block">
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
        <button v-if="!store.isEditing" class="secondary" type="button" @click="importOpen = true">
          Import CSV
        </button>
        <template v-else>
          <button class="primary" type="button" @click="store.commitEditing">Done editing</button>
          <button class="tertiary" type="button" @click="store.cancelEditing">Cancel</button>
        </template>
        <button
          v-if="store.hasUnsavedChanges && store.canWriteToFile && !store.isEditing"
          class="primary"
          type="button"
          :disabled="store.saveState === 'saving'"
          @click="onSave"
        >
          Save to file
        </button>
        <button v-if="!store.isEditing" class="secondary" type="button" @click="store.downloadYaml">
          Download YAML
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

    <div v-if="store.isEditing" class="editing-overlay">
      <LoanEditForm />
    </div>

    <template v-else>
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
            <p class="label">Balance</p>
            <p class="supporting">
              {{ fmtCents(store.computation.summary.current_actual_balance) }}
            </p>
            <p class="caption">
              Scheduled {{ fmtCents(store.computation.summary.current_scheduled_balance) }}
            </p>
          </div>
          <div>
            <p class="label">Interest paid</p>
            <p class="supporting">
              {{ fmtCents(store.computation.summary.actual_interest_to_date) }}
            </p>
            <p class="caption">{{ store.computation.summary.payments_made }} payments</p>
          </div>
          <div>
            <p class="label">Current rate</p>
            <p class="supporting">{{ currentRateDisplay }}</p>
            <p class="caption">Payoff {{ store.computation.summary.projected_payoff_date }}</p>
          </div>
          <div>
            <p class="label">Property value</p>
            <p class="supporting">
              {{ fmtCents(store.activeLoan.valuation.current.amount) }}
            </p>
            <p class="caption">As of {{ store.activeLoan.valuation.current.as_of }}</p>
            <ValuationRefresh />
          </div>
          <div
            title="Scheduled principal-and-interest payment. Either derived from principal + rate + term, or overridden in Edit loan."
          >
            <p class="label">Monthly P+I</p>
            <p class="supporting">
              {{ fmtCents(store.computation.ledger[0]?.scheduled.payment ?? 0) }}
            </p>
            <p class="caption">
              {{ store.activeLoan.loan.monthly_payment ? 'Manual override' : 'Derived' }}
            </p>
          </div>
          <div
            title="Portion of each monthly payment collected by the lender to cover property taxes and insurance."
          >
            <p class="label">Monthly escrow</p>
            <p class="supporting">{{ fmtCents(store.activeLoan.loan.escrow_monthly) }}</p>
            <p class="caption">
              Total payment
              {{
                fmtCents(
                  (store.computation.ledger[0]?.scheduled.payment ?? 0) +
                    store.activeLoan.loan.escrow_monthly,
                )
              }}
            </p>
          </div>
        </div>
      </section>

      <section class="mid">
        <div class="balance-pane">
          <BalanceChart
            :computation="store.computation"
            :scenarios="store.activeScenarios"
            :today="store.today"
            :currency="currency"
          />
        </div>
        <aside class="scenarios">
          <p class="label">Scenarios</p>
          <ul v-if="(store.activeLoan.scenarios ?? []).length">
            <li
              v-for="scenario in store.activeLoan.scenarios ?? []"
              :key="scenario.id"
              :class="{ active: store.activeScenarioId === scenario.id }"
            >
              <button
                type="button"
                class="scenario-card"
                :aria-pressed="store.activeScenarioId === scenario.id"
                @click="store.toggleScenario(scenario.id)"
              >
                <p class="scenario-name">{{ scenario.name }}</p>
                <dl v-if="store.scenarios.get(scenario.id)" class="delta">
                  <div
                    :class="{
                      positive: store.scenarios.get(scenario.id)!.delta.interest_saved > 0,
                      negative: store.scenarios.get(scenario.id)!.delta.interest_saved < 0,
                    }"
                  >
                    <dt>Interest</dt>
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
                    <dt>Sooner</dt>
                    <dd>{{ store.scenarios.get(scenario.id)!.delta.months_sooner }} mo</dd>
                  </div>
                </dl>
              </button>
            </li>
          </ul>
          <p v-else class="readout empty"><em>No scenarios yet.</em></p>
        </aside>
      </section>

      <section class="ledger">
        <AmortizationTable :computation="store.computation" :currency="currency" />
      </section>
    </template>

    <CsvImportDialog :open="importOpen" @close="importOpen = false" />
  </main>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  max-width: 1440px;
  margin: 0 auto;
  padding: 1rem clamp(1rem, 2vw, 2rem);
  gap: 1rem;
  color: var(--ll-ink);
  font-family: var(--ll-font-sans);
  box-sizing: border-box;
  overflow: hidden;
}

.site-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 2rem;
  flex-wrap: wrap;
  flex: none;
}

h1 {
  font-family: var(--ll-font-serif);
  font-size: 1.5625rem;
  font-weight: 500;
  margin: 0;
  line-height: 1.1;
}

.source {
  margin-top: 0.125rem;
}

.dirty {
  color: var(--ll-mark);
  margin-left: 0.5rem;
}

.controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

button {
  font-family: var(--ll-font-sans);
  font-size: 0.8125rem;
  padding: 0.375rem 0.875rem;
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
  padding: 0.5rem 0.875rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  flex: none;
}

.banner ul {
  margin: 0.25rem 0 0;
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
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0 0 0.25rem;
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
  line-height: 1.2;
}

.caption {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
  margin: 0.125rem 0 0;
}

.readout {
  font-family: var(--ll-font-serif);
  font-style: italic;
  color: var(--ll-ink-soft);
}

.readout.empty {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
  margin: 0.5rem 0 0;
}

.summary {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 2rem;
  align-items: center;
  padding: 1.5rem 0;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: 1px solid var(--ll-ink-faint);
  flex: none;
}

.summary-gauge {
  display: flex;
  justify-content: center;
}

.summary-gauge :deep(svg) {
  max-width: 260px;
}

.summary-facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1.5rem 2rem;
}

.mid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 1.5rem;
  min-height: 0;
  flex: none;
  height: 480px;
}

.balance-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.balance-pane :deep(figure) {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: 0;
}

.balance-pane :deep(svg) {
  flex: 1 1 auto;
  min-height: 0;
  max-height: 100%;
}

.scenarios {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.scenarios ul {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  min-height: 0;
}

.scenario-card {
  width: 100%;
  background: var(--ll-paper-sunk);
  border: none;
  border-left: 2px solid transparent;
  border-radius: 4px;
  padding: 0.625rem 0.875rem;
  text-align: left;
  cursor: pointer;
  color: var(--ll-ink);
  font-family: inherit;
  transition:
    border-color 120ms,
    background 120ms;
}

.scenario-card:hover {
  border-left-color: var(--ll-ink-muted);
}

.scenarios li.active .scenario-card {
  border-left-color: var(--ll-mark);
}

.scenario-name {
  font-family: var(--ll-font-serif);
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.25rem;
  line-height: 1.2;
}

.delta {
  margin: 0;
  display: grid;
  gap: 0.125rem;
}

.delta div {
  display: flex;
  justify-content: space-between;
  font-size: 0.8125rem;
}

.delta dt {
  color: var(--ll-ink-muted);
  font-size: 0.6875rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
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

.ledger {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editing-overlay {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 1rem;
}

@media (width < 900px) {
  .app {
    height: auto;
    max-height: none;
    overflow: auto;
  }

  .summary {
    grid-template-columns: 1fr;
  }

  .mid {
    grid-template-columns: 1fr;
    height: auto;
  }

  .ledger {
    flex: none;
  }
}
</style>
