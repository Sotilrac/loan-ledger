<script setup lang="ts">
import { computed, ref } from 'vue';
import BalanceChart from './charts/BalanceChart.vue';
import EquityGauge from './charts/EquityGauge.vue';
import { formatMonthLabel } from './charts/scale.js';
import AmortizationTable from './components/AmortizationTable.vue';
import CsvImportDialog from './components/CsvImportDialog.vue';
import FilePicker from './components/FilePicker.vue';
import LoanEditForm from './components/LoanEditForm.vue';
import ScenariosPanel from './components/ScenariosPanel.vue';
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
  if (store.source === 'demo') return 'Demo loan';
  return store.fileName;
});

const lastUpdatedYear = 2026;

async function onSave() {
  await store.save();
}
</script>

<template>
  <main class="app">
    <header class="site-header">
      <div class="title-block">
        <p class="eyebrow">
          Loan Ledger
          <span class="by">
            by
            <a href="https://asmat.ca" target="_blank" rel="noopener noreferrer">Carlos Asmat</a>
          </span>
        </p>
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
        <button
          v-if="!store.isEditing"
          class="tertiary demo-btn"
          type="button"
          @click="store.loadDemo"
        >
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
            data-tooltip="Scheduled principal-and-interest payment. Either derived from principal + rate + term, or overridden in Edit loan."
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
            data-tooltip="Portion of each monthly payment collected by the lender to cover property taxes and insurance."
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
            data-tooltip="Interest you didn't pay because your actual payments reduced the balance faster than the lender's scheduled path. (scheduled interest − actual interest, to date)"
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
        <ScenariosPanel />
      </section>

      <section class="ledger">
        <AmortizationTable :computation="store.computation" :currency="currency" />
      </section>
    </template>

    <CsvImportDialog :open="importOpen" @close="importOpen = false" />

    <small class="attribution" aria-label="Attribution">
      {{ lastUpdatedYear }}
      <span class="sep">·</span>
      <a href="https://gitlab.com/sotilrac/loan-ledger" target="_blank" rel="noopener noreferrer">
        View source
      </a>
    </small>
  </main>
</template>

<style scoped src="./App.css"></style>
