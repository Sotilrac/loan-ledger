<script setup lang="ts">
import {
  AmortizationTable,
  BalanceChart,
  CsvImportDialog,
  EquityGauge,
  format as fmt,
  LoanEditForm,
  ScenariosPanel,
  useLoanStore,
} from '@loan-ledger/ui';
import { computed, onMounted, ref, watch } from 'vue';
import { OcsLoanSource } from '../source/ocsLoanSource.js';
import { useLoansStore } from '../stores/loans.js';

const props = defineProps<{ fileId: number }>();

const loansStore = useLoansStore();
const loan = useLoanStore();

const importOpen = ref(false);
const loadError = ref<string | null>(null);
const loaded = ref(false);

const currency = computed(() => loan.activeLoan.property.currency);
const fmtCents = (n: number): string => fmt.fmtCents(n, currency.value);

const principalRepaid = computed(
  () =>
    loan.computation.summary.original_principal - loan.computation.summary.current_actual_balance,
);
const principalRepaidRatio = computed(
  () => principalRepaid.value / loan.computation.summary.original_principal,
);

const currentRateDisplay = computed(() => {
  const madeRows = loan.computation.ledger.filter((r) => r.actual);
  const last = madeRows[madeRows.length - 1];
  return fmt.fmtPercent(last?.rate ?? loan.activeLoan.loan.annual_rate);
});

const appreciation = computed(() => {
  const purchase = loan.activeLoan.property.purchase_price;
  const current = loan.activeLoan.valuation.current.amount;
  if (!purchase) return null;
  return { abs: current - purchase, pct: (current - purchase) / purchase };
});

async function load(): Promise<void> {
  loadError.value = null;
  loaded.value = false;

  if (loansStore.entries.length === 0) {
    await loansStore.refresh();
  }
  const entry = loansStore.getById(props.fileId);
  if (!entry) {
    loadError.value = `No loan with id ${props.fileId} in the configured folder.`;
    return;
  }

  const ok = await loan.attachSource(new OcsLoanSource(entry));
  if (!ok) {
    loadError.value = 'Loan file failed validation. See banner above.';
    return;
  }
  loaded.value = true;
}

async function onSave(): Promise<void> {
  await loan.save();
}

onMounted(load);
watch(() => props.fileId, load);
</script>

<template>
  <section class="ll-detail">
    <p>
      <RouterLink :to="{ name: 'list' }">← Back to loans</RouterLink>
    </p>

    <div v-if="loadError" class="ll-error">{{ loadError }}</div>

    <template v-else-if="loaded">
      <header class="ll-detail__header">
        <div>
          <p class="ll-detail__eyebrow">{{ loan.fileName }}</p>
          <h2 class="ll-detail__title">{{ loan.activeLoan.property.name }}</h2>
        </div>
        <div class="ll-detail__actions">
          <button
            type="button"
            class="ll-btn"
            :disabled="loan.isEditing"
            @click="loan.startEditing()"
          >
            Edit
          </button>
          <button
            v-if="loan.isEditing"
            type="button"
            class="ll-btn ll-btn--primary"
            :disabled="loan.saveState === 'saving'"
            @click="onSave"
          >
            {{ loan.saveState === 'saving' ? 'Saving…' : 'Save' }}
          </button>
          <button v-if="loan.isEditing" type="button" class="ll-btn" @click="loan.cancelEditing()">
            Cancel
          </button>
          <button type="button" class="ll-btn" @click="importOpen = true">Import payments</button>
        </div>
      </header>

      <p v-if="loan.saveError" class="ll-error" style="margin-bottom: 1rem">
        {{ loan.saveError }}
      </p>

      <div class="ll-detail__summary">
        <EquityGauge
          :equity="loan.computation.summary.equity ?? 0"
          :property-value="loan.activeLoan.valuation.current.amount"
          :currency="currency"
        />
        <dl class="ll-detail__facts">
          <div>
            <dt>Balance</dt>
            <dd>{{ fmtCents(loan.computation.summary.current_actual_balance) }}</dd>
          </div>
          <div>
            <dt>Monthly payment</dt>
            <dd>
              {{
                fmtCents(
                  (loan.computation.ledger[0]?.scheduled.payment ?? 0) +
                    loan.activeLoan.loan.escrow_monthly,
                )
              }}
            </dd>
          </div>
          <div>
            <dt>Rate</dt>
            <dd>{{ currentRateDisplay }}</dd>
          </div>
          <div>
            <dt>Principal repaid</dt>
            <dd>
              {{ fmtCents(principalRepaid) }}
              <small>({{ fmt.fmtPct1(principalRepaidRatio) }})</small>
            </dd>
          </div>
          <div v-if="appreciation">
            <dt>Appreciation</dt>
            <dd>
              {{ fmtCents(appreciation.abs) }}
              <small>({{ fmt.fmtPct1(appreciation.pct) }})</small>
            </dd>
          </div>
          <div>
            <dt>Months ahead</dt>
            <dd>{{ fmt.monthsLabel(loan.computation.summary.months_ahead_of_schedule) }}</dd>
          </div>
        </dl>
        <ScenariosPanel />
      </div>

      <LoanEditForm v-if="loan.isEditing" />

      <h3 class="ll-detail__section">Balance over time</h3>
      <BalanceChart
        :computation="loan.computation"
        :scenarios="loan.activeScenarios"
        :currency="currency"
      />

      <h3 class="ll-detail__section">Amortization</h3>
      <AmortizationTable :computation="loan.computation" :currency="currency" />

      <CsvImportDialog :open="importOpen" @close="importOpen = false" />
    </template>

    <div v-else class="ll-empty">Loading…</div>
  </section>
</template>

<style scoped>
.ll-detail__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.ll-detail__eyebrow {
  font-size: 0.75rem;
  color: var(--color-text-maxcontrast, #888);
  font-family: var(--ll-font-mono, ui-monospace, monospace);
  margin: 0 0 0.25rem;
}

.ll-detail__title {
  margin: 0;
  font-size: 1.5rem;
}

.ll-detail__actions {
  display: flex;
  gap: 0.5rem;
}

.ll-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border, #ccc);
  background: var(--color-main-background, #fff);
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

.ll-btn:hover:not(:disabled) {
  border-color: var(--color-primary-element, #0082c9);
}

.ll-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ll-btn--primary {
  background: var(--color-primary-element, #0082c9);
  color: #fff;
  border-color: var(--color-primary-element, #0082c9);
}

.ll-detail__summary {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 2fr 1fr;
  gap: 1.5rem;
  align-items: start;
  margin-bottom: 1.5rem;
}

@media (width <= 64rem) {
  .ll-detail__summary {
    grid-template-columns: 1fr;
  }
}

.ll-detail__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem 1.5rem;
  margin: 0;
}

.ll-detail__facts dt {
  font-size: 0.6875rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-maxcontrast, #888);
}

.ll-detail__facts dd {
  margin: 0.125rem 0 0;
  font-size: 1.125rem;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
}

.ll-detail__facts small {
  font-size: 0.75rem;
  color: var(--color-text-maxcontrast, #888);
}

.ll-detail__section {
  margin: 2rem 0 0.75rem;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-maxcontrast, #555);
  font-weight: 500;
}
</style>
