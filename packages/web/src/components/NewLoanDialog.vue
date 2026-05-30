<script setup lang="ts">
import { buildNewLoan, serializeLoanYaml } from '@loan-ledger/core';
import { FallbackSource, useLoanStore } from '@loan-ledger/ui';
import { ref, watch } from 'vue';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const store = useLoanStore();
const dialogRef = ref<HTMLDialogElement | null>(null);

const name = ref('');
const principal = ref<number | null>(null);
const ratePercent = ref<number | null>(null);
const termYears = ref<number>(30);
const error = ref<string | null>(null);

function reset() {
  name.value = '';
  principal.value = null;
  ratePercent.value = null;
  termYears.value = 30;
  error.value = null;
}

function slugify(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'loan'}.loan.yaml`;
}

async function create() {
  error.value = null;
  if (!name.value.trim() || !principal.value || !termYears.value || ratePercent.value === null) {
    error.value = 'Fill in every field.';
    return;
  }
  const loan = buildNewLoan({
    name: name.value.trim(),
    principal: principal.value,
    annualRatePercent: ratePercent.value,
    termMonths: Math.round(termYears.value * 12),
  });
  const source = new FallbackSource(slugify(name.value), serializeLoanYaml(loan));
  const ok = await store.attachSource(source);
  if (!ok) {
    error.value = 'Could not create the loan.';
    return;
  }
  emit('close');
}

function cancel() {
  emit('close');
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      reset();
      dialogRef.value?.showModal();
    } else {
      dialogRef.value?.close();
    }
  },
);
</script>

<template>
  <dialog ref="dialogRef" class="new-loan-dialog" @close="cancel">
    <form method="dialog" @submit.prevent="create">
      <header>
        <p class="eyebrow">New loan</p>
        <h2>Start a loan from scratch</h2>
        <p class="caption">
          The minimum to get going. The loan starts today; property value seeds from the principal.
          Everything is editable afterwards, and nothing is saved until you export.
        </p>
      </header>

      <div class="grid">
        <div class="field">
          <label for="nl-name">Name</label>
          <input
            id="nl-name"
            v-model="name"
            type="text"
            placeholder="e.g. Refi option A"
            required
          />
        </div>
        <div class="field">
          <label for="nl-principal">Principal</label>
          <input
            id="nl-principal"
            v-model.number="principal"
            type="number"
            min="1"
            step="any"
            placeholder="300000"
            required
          />
        </div>
        <div class="field">
          <label for="nl-rate">Annual rate (%)</label>
          <input
            id="nl-rate"
            v-model.number="ratePercent"
            type="number"
            min="0"
            step="0.01"
            placeholder="6.5"
            required
          />
        </div>
        <div class="field">
          <label for="nl-term">Term (years)</label>
          <input id="nl-term" v-model.number="termYears" type="number" min="1" step="1" required />
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <footer>
        <button type="button" class="tertiary" @click="cancel">Cancel</button>
        <button type="submit" class="primary">Create loan</button>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.new-loan-dialog {
  max-width: 540px;
  width: 100%;
  border: none;
  border-radius: 8px;
  padding: 2rem;
  background: var(--ll-paper-raised);
  color: var(--ll-ink);
  font-family: var(--ll-font-sans);
  box-shadow: 0 8px 32px rgb(var(--ll-shadow-rgb) / 12%);
}

.new-loan-dialog::backdrop {
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

.eyebrow {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0;
}

.caption {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
  margin: 0;
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

.field input {
  font-family: var(--ll-font-sans);
  font-size: 1rem;
  padding: 0.5rem 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ll-ink-faint);
  border-radius: 0;
  color: var(--ll-ink);
}

.field input:focus {
  outline: none;
  border-bottom-color: var(--ll-accent);
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
}
</style>
