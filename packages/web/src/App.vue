<script setup lang="ts">
import {
  AmortizationTable,
  BalanceChart,
  CsvImportDialog,
  EquityGauge,
  FallbackSource,
  format as fmt,
  formatMonthFullYear,
  formatMonthLabel,
  LoanEditForm,
  NewLoanDialog,
  ScenariosPanel,
  useLoanStore,
} from '@loan-ledger/ui';
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import FilePicker from './components/FilePicker.vue';

const store = useLoanStore();
const importOpen = ref(false);
const newLoanOpen = ref(false);
const menuOpen = ref(false);
const menuRoot = ref<HTMLElement | null>(null);

function toggleMenu(): void {
  menuOpen.value = !menuOpen.value;
}

function closeMenu(): void {
  menuOpen.value = false;
}

function handleDocClick(event: MouseEvent): void {
  if (!menuOpen.value) return;
  const root = menuRoot.value;
  if (root && !root.contains(event.target as Node)) closeMenu();
}

onMounted(() => document.addEventListener('click', handleDocClick));
onBeforeUnmount(() => document.removeEventListener('click', handleDocClick));

const currency = computed(() => store.activeLoan.property.currency);

const fmtCents = (n: number): string => fmt.fmtCents(n, currency.value);
const fmtCentsCompact = (n: number): string => fmt.fmtCentsCompact(n, currency.value);
const { fmtPct1, monthsLabel } = fmt;

const currentRateDisplay = computed(() => {
  const madeRows = store.computation.ledger.filter((r) => r.actual);
  const last = madeRows[madeRows.length - 1];
  return fmt.fmtPercent(last?.rate ?? store.activeLoan.loan.annual_rate);
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

const sourceLabel = computed(() => {
  if (store.source.kind === 'demo') {
    return 'Demo loan · tap Edit to customize, or Load loan to open your own .loan.yaml';
  }
  return store.fileName;
});

const lastUpdatedYear = 2026;

watchEffect(() => {
  const name = store.activeLoan.property.name?.trim();
  document.title = name ? `${name} — Loan Ledger` : 'Loan Ledger';
});

async function onSave() {
  await store.save();
}

function slugifyName(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'loan'}.loan.yaml`;
}

async function onCreateNewLoan(payload: { name: string; yaml: string }) {
  const ok = await store.attachSource(new FallbackSource(slugifyName(payload.name), payload.yaml));
  if (ok) newLoanOpen.value = false;
}
</script>

<template>
  <main class="app">
    <header class="site-header">
      <div class="header-top">
        <p class="eyebrow">
          Loan Ledger
          <span class="by">
            by
            <a href="https://asmat.ca" target="_blank" rel="noopener noreferrer">Carlos Asmat</a>
          </span>
        </p>
        <div ref="menuRoot" class="controls">
          <FilePicker />
          <template v-if="store.isEditing">
            <button class="primary" type="button" @click="store.commitEditing">Done editing</button>
            <button class="tertiary" type="button" @click="store.cancelEditing">Cancel</button>
          </template>
          <template v-else>
            <button
              type="button"
              class="menu-toggle"
              :aria-expanded="menuOpen"
              aria-label="Open menu"
              @click.stop="toggleMenu"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M3 5h14M3 10h14M3 15h14"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                  fill="none"
                />
              </svg>
            </button>
            <div class="controls__menu" :class="{ 'is-open': menuOpen }">
              <button
                class="secondary"
                type="button"
                @click="
                  newLoanOpen = true;
                  closeMenu();
                "
              >
                New loan
              </button>
              <button
                class="secondary"
                type="button"
                @click="
                  store.startEditing();
                  closeMenu();
                "
              >
                Edit
              </button>
              <button
                class="secondary"
                type="button"
                @click="
                  importOpen = true;
                  closeMenu();
                "
              >
                Import payments
              </button>
              <button
                v-if="store.canWriteToFile"
                class="primary"
                type="button"
                :disabled="store.saveState === 'saving'"
                @click="
                  onSave();
                  closeMenu();
                "
              >
                Save to file
              </button>
              <button
                class="secondary"
                type="button"
                @click="
                  store.downloadYaml();
                  closeMenu();
                "
              >
                Save
              </button>
              <button
                class="secondary"
                type="button"
                data-tooltip="Download the amortization table (scheduled + actuals) as CSV"
                @click="
                  store.downloadCsv();
                  closeMenu();
                "
              >
                Export CSV
              </button>
              <button
                class="tertiary"
                type="button"
                @click="
                  store.loadDemo();
                  closeMenu();
                "
              >
                Use demo data
              </button>
            </div>
          </template>
        </div>
      </div>

      <div class="title-block">
        <div class="title-main">
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
    <NewLoanDialog :open="newLoanOpen" @close="newLoanOpen = false" @create="onCreateNewLoan" />

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
