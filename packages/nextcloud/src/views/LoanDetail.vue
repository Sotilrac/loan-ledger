<script setup lang="ts">
import {
  AmortizationTable,
  BalanceChart,
  CsvImportDialog,
  EquityGauge,
  format as fmt,
  formatMonthFullYear,
  formatMonthLabel,
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
const fmtCentsCompact = (n: number): string => fmt.fmtCentsCompact(n, currency.value);
const fmtPct1 = fmt.fmtPct1;

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
        <div class="ll-detail__title-block">
          <p class="eyebrow">{{ loan.fileName }}</p>
          <h2 class="ll-detail__title">{{ loan.activeLoan.property.name }}</h2>
          <p class="caption">
            Purchased {{ formatMonthFullYear(loan.activeLoan.property.purchase_date) }} for
            {{ fmtCentsCompact(loan.activeLoan.property.purchase_price) }}
          </p>
          <p v-if="(loan.activeLoan.property.links ?? []).length" class="property-links">
            <a
              v-for="link in loan.activeLoan.property.links"
              :key="link.url"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ link.label }}
            </a>
          </p>
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
        <div class="ll-detail__gauge">
          <EquityGauge
            :equity="loan.computation.summary.equity ?? 0"
            :property-value="loan.activeLoan.valuation.current.amount"
            :currency="currency"
          />
        </div>
        <div class="ll-detail__facts">
          <div>
            <p class="label">Balance</p>
            <p class="supporting">
              {{ fmtCents(loan.computation.summary.current_actual_balance) }}
            </p>
            <p class="caption">
              Scheduled {{ fmtCents(loan.computation.summary.current_scheduled_balance) }}
            </p>
          </div>
          <div>
            <p class="label">Monthly</p>
            <p class="supporting">
              {{
                fmtCents(
                  (loan.computation.ledger[0]?.scheduled.payment ?? 0) +
                    loan.activeLoan.loan.escrow_monthly,
                )
              }}
            </p>
            <p v-if="loan.activeLoan.loan.escrow_monthly > 0" class="caption">
              {{ fmtCents(loan.computation.ledger[0]?.scheduled.payment ?? 0) }} P+I &nbsp;·&nbsp;
              {{ fmtCents(loan.activeLoan.loan.escrow_monthly) }} escrow
            </p>
            <p v-else class="caption">
              {{ loan.activeLoan.loan.monthly_payment ? 'Manual override' : 'Derived' }}
            </p>
          </div>
          <div>
            <p class="label">Rate</p>
            <p class="supporting">{{ currentRateDisplay }}</p>
            <p class="caption">
              Payoff {{ formatMonthLabel(loan.computation.summary.projected_payoff_date) }}
            </p>
          </div>
          <div>
            <p class="label">Interest paid</p>
            <p class="supporting">
              {{ fmtCents(loan.computation.summary.actual_interest_to_date) }}
            </p>
            <p class="caption">{{ loan.computation.summary.payments_made }} payments</p>
          </div>
          <div>
            <p class="label">Principal paid</p>
            <p class="supporting">{{ fmtCents(principalRepaid) }}</p>
            <p class="caption">{{ fmtPct1(principalRepaidRatio) }} of original loan</p>
          </div>
          <div>
            <p class="label">Current valuation</p>
            <p class="supporting">
              {{ fmtCents(loan.activeLoan.valuation.current.amount) }}
            </p>
            <p class="caption">
              As of {{ formatMonthLabel(loan.activeLoan.valuation.current.as_of) }}
            </p>
          </div>
          <div v-if="appreciation">
            <p class="label">Appreciation</p>
            <p
              class="supporting"
              :class="{ positive: appreciation.abs > 0, negative: appreciation.abs < 0 }"
            >
              {{ fmtCentsCompact(appreciation.abs) }}
            </p>
            <p class="caption">{{ fmtPct1(appreciation.pct) }} since purchase</p>
          </div>
          <div>
            <p class="label">Months ahead</p>
            <p
              class="supporting"
              :class="{
                positive: loan.computation.summary.months_ahead_of_schedule > 0,
                negative: loan.computation.summary.months_ahead_of_schedule < 0,
              }"
            >
              {{ fmt.monthsLabel(loan.computation.summary.months_ahead_of_schedule) }}
            </p>
            <p class="caption">
              Payoff {{ formatMonthLabel(loan.computation.summary.projected_payoff_date) }}
            </p>
          </div>
        </div>
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

.ll-detail__title-block {
  flex: 1 1 auto;
  min-width: 0;
}

.ll-detail__title {
  font-family: var(--ll-font-serif);
  font-size: 1.5625rem;
  font-weight: 500;
  line-height: 1.1;
  margin: 0.125rem 0 0;
}

.ll-detail__actions {
  display: flex;
  gap: 0.5rem;
  flex: none;
}

.ll-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--ll-ink-faint);
  background: var(--ll-paper-raised, var(--color-main-background, #fff));
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
  font: inherit;
}

.ll-btn:hover:not(:disabled) {
  border-color: var(--ll-accent);
}

.ll-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ll-btn--primary {
  background: var(--ll-accent);
  color: #fff;
  border-color: var(--ll-accent);
}

.ll-btn--primary:hover:not(:disabled) {
  background: var(--ll-accent-hover);
}

.ll-detail__summary {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 320px;
  gap: 2rem;
  align-items: start;
  padding: 1.5rem 0;
  border-top: 1px solid var(--ll-ink-faint);
  border-bottom: 1px solid var(--ll-ink-faint);
  margin-bottom: 1.5rem;
}

.ll-detail__gauge {
  display: flex;
  justify-content: center;
}

.ll-detail__gauge :deep(svg) {
  max-width: 220px;
}

@media (width <= 64rem) {
  .ll-detail__summary {
    grid-template-columns: 1fr;
  }
}

.ll-detail__facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 1.5rem 2rem;
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
