<script setup lang="ts">
import { computed, ref } from 'vue';
import BalanceChart from './charts/BalanceChart.vue';
import EquityGauge from './charts/EquityGauge.vue';
import { formatMonthFullYear, formatMonthLabel } from './charts/scale.js';
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

const fmtPct1 = (n: number): string => `${(n * 100).toFixed(1)}%`;

const currentRateDisplay = computed(() => {
  const madeRows = store.computation.ledger.filter((r) => r.actual);
  const last = madeRows[madeRows.length - 1];
  return fmtPercent(last?.rate ?? store.activeLoan.loan.annual_rate);
});

const principalRepaid = computed(
  () =>
    store.computation.summary.original_principal - store.computation.summary.current_actual_balance,
);

const principalRepaidRatio = computed(
  () => principalRepaid.value / store.computation.summary.original_principal,
);

const appreciation = computed(() => {
  const purchase = store.activeLoan.property.purchase_price;
  const current = store.activeLoan.valuation.current.amount;
  if (!purchase) return null;
  return { abs: current - purchase, pct: (current - purchase) / purchase };
});

const fmtCentsCompact = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.value,
    maximumFractionDigits: 0,
  }).format(n);

function monthsLabel(n: number): string {
  if (n === 0) return 'On schedule';
  const abs = Math.abs(n);
  const years = Math.floor(abs / 12);
  const rem = abs % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rem) parts.push(`${rem} mo`);
  if (!parts.length) parts.push('0 mo');
  return (n > 0 ? '+' : '−') + parts.join(' ');
}

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
        <p class="caption purchase-info">
          Purchased {{ formatMonthFullYear(store.activeLoan.property.purchase_date) }} for
          {{ fmtCentsCompact(store.activeLoan.property.purchase_price) }}
        </p>
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
          <div data-tooltip="Scheduled principal-and-interest payment, plus escrow if applicable.">
            <p class="label">Monthly</p>
            <p class="supporting">
              {{
                fmtCents(
                  (store.computation.ledger[0]?.scheduled.payment ?? 0) +
                    store.activeLoan.loan.escrow_monthly,
                )
              }}
            </p>
            <p v-if="store.activeLoan.loan.escrow_monthly > 0" class="caption">
              {{ fmtCents(store.computation.ledger[0]?.scheduled.payment ?? 0) }} P+I &nbsp;·&nbsp;
              {{ fmtCents(store.activeLoan.loan.escrow_monthly) }} escrow
            </p>
            <p v-else class="caption">
              {{ store.activeLoan.loan.monthly_payment ? 'Manual override' : 'Derived' }}
            </p>
          </div>
          <div>
            <p class="label">Rate</p>
            <p class="supporting">{{ currentRateDisplay }}</p>
            <p class="caption">
              Payoff {{ formatMonthLabel(store.computation.summary.projected_payoff_date) }}
            </p>
          </div>
          <div>
            <p class="label">Interest paid</p>
            <p class="supporting">
              {{ fmtCents(store.computation.summary.actual_interest_to_date) }}
            </p>
            <p class="caption">{{ store.computation.summary.payments_made }} payments</p>
          </div>
          <div data-tooltip="How much of your original loan balance you've already repaid.">
            <p class="label">Principal paid</p>
            <p class="supporting">{{ fmtCents(principalRepaid) }}</p>
            <p class="caption">{{ fmtPct1(principalRepaidRatio) }} of original loan</p>
          </div>
          <div>
            <p class="label">Current valuation</p>
            <p class="supporting">
              {{ fmtCents(store.activeLoan.valuation.current.amount) }}
            </p>
            <p class="caption">
              As of {{ formatMonthLabel(store.activeLoan.valuation.current.as_of) }}
            </p>
          </div>
          <div
            v-if="appreciation"
            data-tooltip="Change in property value since purchase. Not realized until you sell."
          >
            <p class="label">Appreciation</p>
            <p
              class="supporting"
              :class="{ positive: appreciation.abs > 0, negative: appreciation.abs < 0 }"
            >
              {{ fmtCentsCompact(appreciation.abs) }}
            </p>
            <p class="caption">{{ fmtPct1(appreciation.pct) }} since purchase</p>
          </div>
          <div
            v-if="store.interestSavedByExtras > 0"
            data-tooltip="Interest you didn't pay because your actual payments reduced the balance faster than the lender's scheduled path. (scheduled interest − actual interest, to date)"
          >
            <p class="label">Interest saved</p>
            <p class="supporting positive">
              {{ fmtCents(store.interestSavedByExtras) }}
            </p>
            <p class="caption">vs. the lender's schedule</p>
          </div>
          <div
            data-tooltip="How far ahead of (or behind) the lender's original schedule your balance sits today."
          >
            <p class="label">Ahead of schedule</p>
            <p
              class="supporting"
              :class="{
                positive: store.computation.summary.months_ahead_of_schedule > 0,
                negative: store.computation.summary.months_ahead_of_schedule < 0,
              }"
            >
              {{ monthsLabel(store.computation.summary.months_ahead_of_schedule) }}
            </p>
            <p class="caption">
              Projected payoff
              {{ formatMonthLabel(store.computation.summary.projected_payoff_date) }}
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
