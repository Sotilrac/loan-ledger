<script setup lang="ts">
import { PhPencilSimple, PhPlus, PhTrash, PhX } from '@phosphor-icons/vue';
import { computed, ref } from 'vue';
import BalanceChart from './charts/BalanceChart.vue';
import EquityGauge from './charts/EquityGauge.vue';
import { formatMonthLabel } from './charts/scale.js';
import AmortizationTable from './components/AmortizationTable.vue';
import CsvImportDialog from './components/CsvImportDialog.vue';
import FilePicker from './components/FilePicker.vue';
import LoanEditForm from './components/LoanEditForm.vue';
import ScenarioEditor from './components/ScenarioEditor.vue';
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

function fmtInterestDelta(n: number): string {
  if (n === 0) return 'no interest change';
  const abs = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.value,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return n > 0 ? `−${abs} interest` : `+${abs} interest`;
}

function fmtMonthsDelta(n: number): string {
  if (n === 0) return 'same payoff date';
  const abs = Math.abs(n);
  const unit = abs === 1 ? 'month' : 'months';
  return n > 0 ? `${abs} ${unit} earlier` : `${abs} ${unit} later`;
}

const currentRateDisplay = computed(() => {
  const madeRows = store.computation.ledger.filter((r) => r.actual);
  const last = madeRows[madeRows.length - 1];
  return fmtPercent(last?.rate ?? store.activeLoan.loan.annual_rate);
});

const sourceLabel = computed(() => {
  if (store.source === 'demo') return 'Demo loan';
  return store.fileName;
});

async function onSave() {
  await store.save();
}

function addScenario() {
  const id = `scenario-${Date.now().toString(36)}`;
  store.updateLoan((l) => {
    const list = (l.scenarios ??= []);
    list.push({ id, name: `Scenario ${list.length + 1}`, mutations: [] });
  });
  store.activeScenarioId = id;
  store.editingScenarioId = id;
}

function removeScenario(id: string) {
  store.updateLoan((l) => {
    if (!l.scenarios) return;
    l.scenarios = l.scenarios.filter((s) => s.id !== id);
  });
  if (store.activeScenarioId === id) store.activeScenarioId = null;
  if (store.editingScenarioId === id) store.editingScenarioId = null;
}
</script>

<template>
  <main class="app">
    <header class="site-header">
      <div class="title-block">
        <p class="eyebrow">Loan Ledger</p>
        <h1>{{ store.activeLoan.property.name }}</h1>
        <p class="source caption">{{ sourceLabel }}</p>
        <p v-if="(store.activeLoan.property.links ?? []).length" class="property-links">
          <a
            v-for="link in store.activeLoan.property.links"
            :key="link.url"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ link.label }}
          </a>
        </p>
      </div>
      <div class="controls">
        <FilePicker />
        <button v-if="!store.isEditing" class="secondary" type="button" @click="store.startEditing">
          Edit
        </button>
        <button v-if="!store.isEditing" class="secondary" type="button" @click="importOpen = true">
          Import payments
        </button>
        <template v-else>
          <button class="primary" type="button" @click="store.commitEditing">Done editing</button>
          <button class="tertiary" type="button" @click="store.cancelEditing">Cancel</button>
        </template>
        <button
          v-if="store.canWriteToFile && !store.isEditing"
          class="primary"
          type="button"
          :disabled="store.saveState === 'saving'"
          @click="onSave"
        >
          Save to file
        </button>
        <button v-if="!store.isEditing" class="secondary" type="button" @click="store.downloadYaml">
          Save
        </button>
        <button v-if="!store.isEditing" class="tertiary" type="button" @click="store.loadDemo">
          Use demo data
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
            <p class="caption">
              Payoff {{ formatMonthLabel(store.computation.summary.projected_payoff_date) }}
            </p>
          </div>
          <div>
            <p class="label">Property value</p>
            <p class="supporting">
              {{ fmtCents(store.activeLoan.valuation.current.amount) }}
            </p>
            <p class="caption">
              As of {{ formatMonthLabel(store.activeLoan.valuation.current.as_of) }}
            </p>
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
            v-if="store.activeLoan.loan.escrow_monthly > 0"
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
          <div
            v-if="store.interestSavedByExtras > 0"
            title="Interest you didn't pay because your actual payments reduced the balance faster than the lender's scheduled path. (scheduled interest − actual interest, to date)"
          >
            <p class="label">Interest saved so far</p>
            <p class="supporting positive">
              {{ fmtCents(store.interestSavedByExtras) }}
            </p>
            <p class="caption">vs. the lender's scheduled path</p>
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
          <div class="scenarios-header">
            <p class="label">Scenarios</p>
            <button
              type="button"
              class="icon-btn"
              title="Add scenario"
              aria-label="Add scenario"
              @click="addScenario"
            >
              <PhPlus :size="16" weight="regular" />
            </button>
          </div>

          <ul v-if="(store.activeLoan.scenarios ?? []).length">
            <li
              v-for="scenario in store.activeLoan.scenarios ?? []"
              :key="scenario.id"
              :class="{
                active: store.activeScenarioId === scenario.id,
                editing: store.editingScenarioId === scenario.id,
              }"
            >
              <div
                class="scenario-card"
                :aria-pressed="store.activeScenarioId === scenario.id"
                role="button"
                :tabindex="0"
                @click="store.toggleScenario(scenario.id)"
                @keyup.enter="store.toggleScenario(scenario.id)"
              >
                <div class="scenario-top">
                  <p class="scenario-name">{{ scenario.name }}</p>
                  <div
                    v-if="
                      store.activeScenarioId === scenario.id ||
                      store.editingScenarioId === scenario.id
                    "
                    class="actions"
                  >
                    <button
                      type="button"
                      class="icon-btn"
                      :title="
                        store.editingScenarioId === scenario.id ? 'Close editor' : 'Edit scenario'
                      "
                      :aria-label="
                        store.editingScenarioId === scenario.id ? 'Close editor' : 'Edit scenario'
                      "
                      @click.stop="store.toggleEditingScenario(scenario.id)"
                    >
                      <PhX
                        v-if="store.editingScenarioId === scenario.id"
                        :size="15"
                        weight="regular"
                      />
                      <PhPencilSimple v-else :size="15" weight="regular" />
                    </button>
                    <button
                      type="button"
                      class="icon-btn danger"
                      title="Delete scenario"
                      aria-label="Delete scenario"
                      @click.stop="removeScenario(scenario.id)"
                    >
                      <PhTrash :size="15" weight="regular" />
                    </button>
                  </div>
                </div>
                <p v-if="scenario.description" class="scenario-desc">{{ scenario.description }}</p>
                <ul v-if="store.scenarios.get(scenario.id)" class="delta">
                  <li
                    :class="{
                      positive: store.scenarios.get(scenario.id)!.delta.interest_saved > 0,
                      negative: store.scenarios.get(scenario.id)!.delta.interest_saved < 0,
                    }"
                  >
                    {{ fmtInterestDelta(store.scenarios.get(scenario.id)!.delta.interest_saved) }}
                  </li>
                  <li
                    :class="{
                      positive: store.scenarios.get(scenario.id)!.delta.months_sooner > 0,
                      negative: store.scenarios.get(scenario.id)!.delta.months_sooner < 0,
                    }"
                  >
                    {{ fmtMonthsDelta(store.scenarios.get(scenario.id)!.delta.months_sooner) }}
                  </li>
                </ul>

                <ScenarioEditor
                  v-if="store.editingScenarioId === scenario.id"
                  :scenario-id="scenario.id"
                />
              </div>
            </li>
          </ul>
          <p v-else class="readout empty"><em>No scenarios yet. Click + to add one.</em></p>
        </aside>
      </section>

      <section class="ledger">
        <AmortizationTable :computation="store.computation" :currency="currency" />
      </section>
    </template>

    <CsvImportDialog :open="importOpen" @close="importOpen = false" />

    <aside class="attribution" aria-label="Attribution">
      <span class="attribution-line">
        <a href="https://gitlab.com/sotilrac/loan-ledger" target="_blank" rel="noopener noreferrer">
          View source
        </a>
        <span class="sep">·</span>
        by
        <a href="https://asmat.ca" target="_blank" rel="noopener noreferrer">Carlos Asmat</a>
      </span>
    </aside>
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

.property-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0.375rem 0 0;
  font-size: 0.8125rem;
}

.property-links a {
  color: var(--ll-accent);
  text-decoration: none;
  border-bottom: 1px dotted var(--ll-ink-faint);
}

.property-links a:hover {
  color: var(--ll-accent-hover);
  border-bottom-color: var(--ll-accent);
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
  border: 1px solid var(--ll-accent);
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
  border: 1px solid transparent;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--ll-ink-faint);
}

.tertiary:hover {
  color: var(--ll-ink);
  text-decoration-color: var(--ll-ink);
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

.supporting.positive {
  color: var(--ll-positive);
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
  grid-template-columns: minmax(0, 1fr) 340px;
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
  width: 100%;
  height: auto;
}

.scenarios {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.scenarios-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--ll-ink-muted);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
}

.icon-btn:hover {
  color: var(--ll-accent);
  background: var(--ll-accent-soft);
}

.icon-btn.danger:hover {
  color: var(--ll-negative);
  background: var(--ll-negative-soft);
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

.scenario-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.actions {
  display: flex;
  gap: 0.125rem;
  flex-shrink: 0;
}

.scenario-name {
  font-family: var(--ll-font-serif);
  font-size: 1rem;
  font-weight: 500;
  margin: 0 0 0.25rem;
  line-height: 1.2;
}

.delta {
  margin: 0.375rem 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.delta li {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--ll-ink-soft);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.delta .positive {
  color: var(--ll-positive);
}

.delta .negative {
  color: var(--ll-negative);
}

.ledger {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editing-overlay {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 1rem;
}

/* Desktop: tag hanging off the right edge (like a garment hang-tag) */
.attribution {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translate(50%, -50%) rotate(90deg);
  transform-origin: 50% 50%;
  background: var(--ll-paper-sunk);
  border: 1px solid var(--ll-ink-faint);
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  padding: 0.25rem 0.875rem;
  white-space: nowrap;
  pointer-events: auto;
  box-shadow: 0 -1px 3px rgb(0 0 0 / 4%);
}

.attribution-line {
  font-family: var(--ll-font-sans);
  font-size: 0.625rem;
  letter-spacing: 0.04em;
  color: var(--ll-ink-muted);
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
}

.attribution-line a {
  color: var(--ll-ink-soft);
  text-decoration: none;
  border-bottom: 1px dotted var(--ll-ink-faint);
}

.attribution-line a:hover {
  color: var(--ll-accent);
  border-bottom-color: var(--ll-accent);
}

.sep {
  color: var(--ll-ink-faint);
}

@media (width < 900px) {
  .app {
    height: auto;
    max-height: none;
    overflow: auto;
  }

  .mid {
    grid-template-columns: 1fr;
    height: auto;
  }

  .ledger {
    flex: none;
  }

  /* On narrow screens the tag becomes a plain bottom footer */
  .attribution {
    position: static;
    transform: none;
    background: transparent;
    border: none;
    border-top: 1px solid var(--ll-ink-faint);
    border-radius: 0;
    padding: 0.875rem 0;
    margin-top: 1.5rem;
    text-align: center;
    box-shadow: none;
  }

  .attribution-line {
    display: inline-flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.375rem;
  }
}

/* 360px and below: force summary facts into a tight 2-col grid and shrink text */
@media (width < 520px) {
  .app {
    padding: 0.75rem clamp(0.5rem, 2vw, 1rem);
    gap: 0.75rem;
  }

  h1 {
    font-size: 1.25rem;
  }

  .summary {
    grid-template-columns: 1fr;
    padding: 0.75rem 0;
    gap: 1rem;
  }

  .summary-gauge {
    justify-content: flex-start;
  }

  .summary-gauge :deep(svg) {
    max-width: 200px;
  }

  .summary-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem 1rem;
  }

  .supporting {
    font-size: 1.125rem;
  }

  .caption {
    font-size: 0.6875rem;
  }

  .mid {
    height: 320px;
  }

  .controls {
    gap: 0.375rem;
  }

  .controls button {
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
  }
}
</style>
