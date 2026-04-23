<script setup lang="ts">
import type { CsvMapping, Payment } from '@loan-ledger/core';
import { ingestCsv } from '@loan-ledger/core';
import { computed, ref, watch } from 'vue';
import { useLoanStore } from '../stores/loan.js';
import { useMappingsStore } from '../stores/mappings.js';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const loanStore = useLoanStore();
const mappingsStore = useMappingsStore();

const dialogRef = ref<HTMLDialogElement | null>(null);

const fileName = ref<string>('');
const rawCsv = ref<string>('');
const detectedHeaders = ref<string[]>([]);
const selectedMappingName = ref<string>('');
const saveMapping = ref<boolean>(false);

// Mapping form fields (either from saved mapping or user input)
const mappingName = ref<string>('');
const dateColumn = ref<string>('');
const amountColumn = ref<string>('');
const noteColumn = ref<string>('');
const principalColumn = ref<string>('');
const interestColumn = ref<string>('');
const escrowColumn = ref<string>('');
const extraColumn = ref<string>('');
const dateFormat = ref<CsvMapping['date_format']>('YYYY-MM-DD');
const amountSign = ref<'positive' | 'negative'>('negative');
const filterColumn = ref<string>('');
const filterMatches = ref<string>('');

const previewResult = computed(() => {
  if (!rawCsv.value || !dateColumn.value || !amountColumn.value) return null;
  return ingestCsv(rawCsv.value, buildMapping());
});

const previewPayments = computed<Payment[]>(() =>
  previewResult.value?.ok ? previewResult.value.value : [],
);

const previewError = computed<string | null>(() => {
  const r = previewResult.value;
  if (!r || r.ok) return null;
  return r.errors[0]?.message ?? 'Import failed';
});

function buildMapping(): CsvMapping {
  const m: CsvMapping = {
    name: mappingName.value || 'Imported',
    date_format: dateFormat.value,
    amount_sign: amountSign.value,
    columns: {
      date: dateColumn.value,
      amount: amountColumn.value,
    },
  };
  if (noteColumn.value) m.columns.note = noteColumn.value;
  if (principalColumn.value) m.columns.principal = principalColumn.value;
  if (interestColumn.value) m.columns.interest = interestColumn.value;
  if (escrowColumn.value) m.columns.escrow = escrowColumn.value;
  if (extraColumn.value) m.columns.extra = extraColumn.value;
  if (filterColumn.value && filterMatches.value) {
    m.filter = { column: filterColumn.value, matches: filterMatches.value };
  }
  return m;
}

async function onFilePicked(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  fileName.value = file.name;
  rawCsv.value = await file.text();

  // Pull header row for column dropdowns
  const firstLine = rawCsv.value.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
  detectedHeaders.value = firstLine.split(/[,;\t]/).map((h) => h.trim().replace(/^"|"$/g, ''));
  input.value = '';
}

function applyMappingFromSaved(name: string) {
  const m = mappingsStore.getByName(name);
  if (!m) return;
  mappingName.value = m.name;
  dateColumn.value = m.columns.date;
  amountColumn.value = m.columns.amount;
  noteColumn.value = m.columns.note ?? '';
  principalColumn.value = m.columns.principal ?? '';
  interestColumn.value = m.columns.interest ?? '';
  escrowColumn.value = m.columns.escrow ?? '';
  extraColumn.value = m.columns.extra ?? '';
  dateFormat.value = m.date_format;
  amountSign.value = m.amount_sign ?? 'negative';
  filterColumn.value = m.filter?.column ?? '';
  filterMatches.value = m.filter?.matches ?? '';
}

watch(selectedMappingName, (name) => {
  if (name) applyMappingFromSaved(name);
});

function apply() {
  const mapping = buildMapping();
  const result = ingestCsv(rawCsv.value, mapping);
  if (!result.ok) return;
  loanStore.importPayments(result.value);
  if (saveMapping.value && mapping.name.trim()) mappingsStore.upsert(mapping);
  emit('close');
  resetState();
}

function cancel() {
  emit('close');
  resetState();
}

function resetState() {
  fileName.value = '';
  rawCsv.value = '';
  detectedHeaders.value = [];
  selectedMappingName.value = '';
  saveMapping.value = false;
  mappingName.value = '';
  dateColumn.value = '';
  amountColumn.value = '';
  noteColumn.value = '';
  principalColumn.value = '';
  interestColumn.value = '';
  escrowColumn.value = '';
  extraColumn.value = '';
  dateFormat.value = 'YYYY-MM-DD';
  amountSign.value = 'negative';
  filterColumn.value = '';
  filterMatches.value = '';
}

watch(
  () => props.open,
  (open) => {
    if (open) dialogRef.value?.showModal();
    else dialogRef.value?.close();
  },
);

const fmt = (n: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: loanStore.activeLoan.property.currency,
  }).format(n);
</script>

<template>
  <dialog ref="dialogRef" class="import-dialog" @close="cancel">
    <form method="dialog" @submit.prevent="apply">
      <header>
        <p class="eyebrow">Import</p>
        <h2>CSV import</h2>
        <p class="readout">
          <em>Map the columns of your bank's export to the payment fields.</em>
        </p>
      </header>

      <section class="step">
        <label for="csv-file" class="label">1. Choose a CSV file</label>
        <input id="csv-file" type="file" accept=".csv,text/csv" @change="onFilePicked" />
        <p v-if="fileName" class="caption">
          Loaded <strong>{{ fileName }}</strong> ({{ detectedHeaders.length }} columns detected)
        </p>
      </section>

      <section v-if="detectedHeaders.length" class="step">
        <label for="saved-mapping" class="label">
          2. Start from a saved mapping, or map columns manually
        </label>
        <select
          id="saved-mapping"
          v-model="selectedMappingName"
          :disabled="!mappingsStore.mappings.length"
        >
          <option value="">— Manual —</option>
          <option v-for="m in mappingsStore.mappings" :key="m.name" :value="m.name">
            {{ m.name }}
          </option>
        </select>

        <div class="grid">
          <div class="field">
            <label for="date-col">Date column *</label>
            <select id="date-col" v-model="dateColumn">
              <option value="">—</option>
              <option v-for="h in detectedHeaders" :key="`d-${h}`" :value="h">{{ h }}</option>
            </select>
          </div>
          <div class="field">
            <label for="date-format">Date format</label>
            <select id="date-format" v-model="dateFormat">
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
            </select>
          </div>
          <div class="field">
            <label for="amount-col">Amount column *</label>
            <select id="amount-col" v-model="amountColumn">
              <option value="">—</option>
              <option v-for="h in detectedHeaders" :key="`a-${h}`" :value="h">{{ h }}</option>
            </select>
          </div>
          <div class="field">
            <label for="amount-sign">Amount sign</label>
            <select id="amount-sign" v-model="amountSign">
              <option value="negative">Negative (typical bank debit)</option>
              <option value="positive">Positive</option>
            </select>
          </div>
          <div class="field">
            <label for="note-col">Note column</label>
            <select id="note-col" v-model="noteColumn">
              <option value="">—</option>
              <option v-for="h in detectedHeaders" :key="`n-${h}`" :value="h">{{ h }}</option>
            </select>
          </div>
          <div class="field">
            <label for="filter-col">Filter column (optional)</label>
            <select id="filter-col" v-model="filterColumn">
              <option value="">—</option>
              <option v-for="h in detectedHeaders" :key="`f-${h}`" :value="h">{{ h }}</option>
            </select>
          </div>
          <div v-if="filterColumn" class="field">
            <label for="filter-matches">Match (regex)</label>
            <input id="filter-matches" v-model="filterMatches" type="text" placeholder="Mortgage" />
          </div>
        </div>
      </section>

      <section v-if="previewPayments.length > 0" class="step">
        <p class="label">3. Preview</p>
        <p class="caption">
          {{ previewPayments.length }} payments will be imported. Existing payments on the same date
          get replaced.
        </p>
        <table class="preview">
          <thead>
            <tr>
              <th>Date</th>
              <th class="num">Amount</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in previewPayments.slice(0, 5)" :key="i">
              <td>{{ p.date }}</td>
              <td class="num">{{ fmt(p.amount) }}</td>
              <td>{{ p.note ?? '' }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="previewPayments.length > 5" class="caption">
          …and {{ previewPayments.length - 5 }} more.
        </p>

        <label class="save-mapping">
          <input v-model="saveMapping" type="checkbox" />
          Save this mapping for next time
        </label>
        <div v-if="saveMapping" class="field">
          <label for="mapping-name">Mapping name</label>
          <input
            id="mapping-name"
            v-model="mappingName"
            type="text"
            placeholder="e.g. Chase mortgage"
          />
        </div>
      </section>

      <p v-if="previewError" class="error">{{ previewError }}</p>

      <footer>
        <button type="button" class="tertiary" @click="cancel">Cancel</button>
        <button
          type="submit"
          class="primary"
          :disabled="!previewPayments.length || (saveMapping && !mappingName.trim())"
        >
          Import {{ previewPayments.length || '' }} payments
        </button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.import-dialog {
  max-width: 720px;
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 2rem;
  background: var(--ll-paper-raised);
  color: var(--ll-ink);
  font-family: var(--ll-font-sans);
  box-shadow: 0 8px 32px rgb(0 0 0 / 12%);
}

.import-dialog::backdrop {
  background: rgb(0 0 0 / 40%);
}

form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  min-width: 0;
}

header h2 {
  font-family: var(--ll-font-serif);
  font-size: 1.5625rem;
  font-weight: 500;
  margin: 0.25rem 0 0.5rem;
}

.eyebrow,
.label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0;
}

.readout {
  font-family: var(--ll-font-serif);
  font-style: italic;
  color: var(--ll-ink-soft);
  margin: 0.5rem 0 0;
}

.caption {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
  margin: 0.5rem 0 0;
}

.step {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field label {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
}

input[type='file'],
input[type='text'],
select {
  font-family: var(--ll-font-sans);
  font-size: 1rem;
  padding: 0.5rem 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ll-ink-faint);
  color: var(--ll-ink);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

input:focus,
select:focus {
  outline: none;
  border-bottom: 2px solid var(--ll-accent);
  padding-bottom: calc(0.5rem - 1px);
}

.preview {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.preview th {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  text-align: left;
  padding: 0.5rem 0.5rem 0.5rem 0;
  border-bottom: 1px solid var(--ll-ink-faint);
}

.preview td {
  padding: 0.5rem 0.5rem 0.5rem 0;
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
}

.preview .num {
  text-align: right;
}

.save-mapping {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  font-size: 0.875rem;
  margin-top: 0.5rem;
}

.error {
  color: var(--ll-negative);
  font-size: 0.875rem;
  margin: 0;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1rem;
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

.tertiary {
  background: transparent;
  color: var(--ll-ink-muted);
  border: none;
}

.tertiary:hover {
  color: var(--ll-ink);
  text-decoration: underline;
}
</style>
