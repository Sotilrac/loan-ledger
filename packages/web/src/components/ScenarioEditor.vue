<script setup lang="ts">
import type { LoanFile, Mutation, MutationType } from '@loan-ledger/core';
import { computed } from 'vue';
import { useLoanStore } from '../stores/loan.js';

const props = defineProps<{
  scenarioId: string;
}>();

const store = useLoanStore();

const scenario = computed(() =>
  (store.activeLoan.scenarios ?? []).find((s) => s.id === props.scenarioId),
);

const mutationLabels: Record<MutationType, string> = {
  recurring_extra_principal: 'Recurring extra',
  one_time_extra: 'One-time extra',
  change_rate: 'Change rate',
  change_term: 'Change term',
  stop_extra_payments: 'Stop extra payments',
  change_escrow: 'Change escrow',
  remove_payment: 'Remove a payment',
  remove_payments_where: 'Remove payments matching',
  replace_payment: 'Replace a payment',
  set_original_rate: 'Set original rate',
};

function defaultMutation(type: MutationType, loan: LoanFile): Mutation {
  const date = loan.loan.first_payment_date;
  switch (type) {
    case 'recurring_extra_principal':
      return { type, start_date: date, amount: 100 };
    case 'one_time_extra':
      return { type, date, amount: 1000 };
    case 'change_rate':
      return { type, effective_date: date, annual_rate: 0.05 };
    case 'change_term':
      return { type, effective_date: date, term_months: loan.loan.term_months };
    case 'stop_extra_payments':
      return { type, effective_date: date };
    case 'change_escrow':
      return { type, effective_date: date, escrow_monthly: loan.loan.escrow_monthly };
    case 'remove_payment':
      return { type, date };
    case 'remove_payments_where':
      return { type };
    case 'replace_payment':
      return { type, date, with: { date, amount: 0 } };
    case 'set_original_rate':
      return { type, annual_rate: loan.loan.annual_rate };
  }
}

function mutate(mutator: (s: NonNullable<typeof scenario.value>, l: LoanFile) => void) {
  store.updateLoan((l) => {
    const s = (l.scenarios ?? []).find((x) => x.id === props.scenarioId);
    if (!s) return;
    mutator(s, l);
  });
}

function updateName(v: string) {
  mutate((s) => {
    s.name = v;
  });
}

function updateDescription(v: string) {
  mutate((s) => {
    if (v) s.description = v;
    else delete s.description;
  });
}

function addMutation() {
  mutate((s, l) => {
    s.mutations.push(defaultMutation('recurring_extra_principal', l));
  });
}

function removeMutation(index: number) {
  mutate((s) => {
    s.mutations.splice(index, 1);
  });
}

function changeMutationType(index: number, newType: MutationType) {
  mutate((s, l) => {
    s.mutations[index] = defaultMutation(newType, l);
  });
}

function updateMutationField(index: number, field: string, value: string | number) {
  mutate((s) => {
    const m = s.mutations[index];
    if (!m) return;
    if (field === 'end_date' && value === '') {
      if ('end_date' in m) delete m.end_date;
      return;
    }
    if (field === 'note_contains' && value === '') {
      if ('note_contains' in m) delete m.note_contains;
      return;
    }
    (m as Record<string, unknown>)[field] = value;
  });
}

function updateReplacePayment(index: number, field: 'amount' | 'date', value: string | number) {
  mutate((s) => {
    const m = s.mutations[index];
    if (!m || m.type !== 'replace_payment') return;
    if (field === 'date') m.with.date = String(value);
    else m.with.amount = Number(value);
  });
}
</script>

<template>
  <div v-if="scenario" class="editor" @click.stop>
    <div class="field">
      <label :for="`name-${scenarioId}`">Name</label>
      <input
        :id="`name-${scenarioId}`"
        type="text"
        :value="scenario.name"
        @input="updateName(($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="field">
      <label :for="`desc-${scenarioId}`">Description</label>
      <input
        :id="`desc-${scenarioId}`"
        type="text"
        :value="scenario.description ?? ''"
        placeholder="Optional"
        @input="updateDescription(($event.target as HTMLInputElement).value)"
      />
    </div>

    <p class="label sub-label">Mutations</p>
    <p v-if="!scenario.mutations.length" class="empty">
      <em>No mutations yet.</em>
    </p>
    <div v-for="(m, mIdx) in scenario.mutations" :key="mIdx" class="mutation-row">
      <select
        :value="m.type"
        @change="
          changeMutationType(mIdx, ($event.target as HTMLSelectElement).value as MutationType)
        "
      >
        <option v-for="(label, key) in mutationLabels" :key="key" :value="key">
          {{ label }}
        </option>
      </select>

      <template v-if="m.type === 'recurring_extra_principal'">
        <input
          type="date"
          :value="m.start_date"
          data-tooltip="Start date"
          @input="
            updateMutationField(mIdx, 'start_date', ($event.target as HTMLInputElement).value)
          "
        />
        <input
          type="date"
          :value="m.end_date ?? ''"
          data-tooltip="End date (leave blank for forever)"
          @input="updateMutationField(mIdx, 'end_date', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="number"
          step="1"
          min="1"
          :value="m.amount"
          data-tooltip="Amount per month"
          @input="
            updateMutationField(mIdx, 'amount', Number(($event.target as HTMLInputElement).value))
          "
        />
      </template>

      <template v-else-if="m.type === 'one_time_extra'">
        <input
          type="date"
          :value="m.date"
          @input="updateMutationField(mIdx, 'date', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="number"
          step="1"
          min="1"
          :value="m.amount"
          @input="
            updateMutationField(mIdx, 'amount', Number(($event.target as HTMLInputElement).value))
          "
        />
      </template>

      <template v-else-if="m.type === 'change_rate'">
        <input
          type="date"
          :value="m.effective_date"
          @input="
            updateMutationField(mIdx, 'effective_date', ($event.target as HTMLInputElement).value)
          "
        />
        <input
          type="number"
          step="0.01"
          min="0"
          max="30"
          :value="(m.annual_rate * 100).toFixed(3)"
          @input="
            updateMutationField(
              mIdx,
              'annual_rate',
              Number(($event.target as HTMLInputElement).value) / 100,
            )
          "
        />
        <span class="suffix">%</span>
      </template>

      <template v-else-if="m.type === 'change_term'">
        <input
          type="date"
          :value="m.effective_date"
          @input="
            updateMutationField(mIdx, 'effective_date', ($event.target as HTMLInputElement).value)
          "
        />
        <input
          type="number"
          step="1"
          min="1"
          :value="m.term_months"
          @input="
            updateMutationField(
              mIdx,
              'term_months',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
        <span class="suffix">mo</span>
      </template>

      <template v-else-if="m.type === 'stop_extra_payments'">
        <input
          type="date"
          :value="m.effective_date"
          @input="
            updateMutationField(mIdx, 'effective_date', ($event.target as HTMLInputElement).value)
          "
        />
      </template>

      <template v-else-if="m.type === 'change_escrow'">
        <input
          type="date"
          :value="m.effective_date"
          @input="
            updateMutationField(mIdx, 'effective_date', ($event.target as HTMLInputElement).value)
          "
        />
        <input
          type="number"
          step="1"
          min="0"
          :value="m.escrow_monthly"
          @input="
            updateMutationField(
              mIdx,
              'escrow_monthly',
              Number(($event.target as HTMLInputElement).value),
            )
          "
        />
      </template>

      <template v-else-if="m.type === 'remove_payment'">
        <input
          type="date"
          :value="m.date"
          @input="updateMutationField(mIdx, 'date', ($event.target as HTMLInputElement).value)"
        />
      </template>

      <template v-else-if="m.type === 'remove_payments_where'">
        <input
          type="text"
          :value="m.note_contains ?? ''"
          placeholder="Note contains…"
          @input="
            updateMutationField(mIdx, 'note_contains', ($event.target as HTMLInputElement).value)
          "
        />
      </template>

      <template v-else-if="m.type === 'replace_payment'">
        <input
          type="date"
          :value="m.date"
          @input="updateMutationField(mIdx, 'date', ($event.target as HTMLInputElement).value)"
        />
        <input
          type="number"
          step="0.01"
          min="0"
          :value="m.with.amount"
          data-tooltip="Replacement amount"
          @input="updateReplacePayment(mIdx, 'amount', ($event.target as HTMLInputElement).value)"
        />
      </template>

      <template v-else-if="m.type === 'set_original_rate'">
        <input
          type="number"
          step="0.01"
          min="0"
          max="30"
          :value="(m.annual_rate * 100).toFixed(3)"
          @input="
            updateMutationField(
              mIdx,
              'annual_rate',
              Number(($event.target as HTMLInputElement).value) / 100,
            )
          "
        />
        <span class="suffix">%</span>
      </template>

      <button
        type="button"
        class="remove-mutation"
        data-tooltip="Remove"
        @click="removeMutation(mIdx)"
      >
        ×
      </button>
    </div>
    <button type="button" class="add-sub" @click="addMutation">+ Add mutation</button>
  </div>
</template>

<style scoped>
.editor {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--ll-ink-faint);
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.field label {
  font-size: 0.6875rem;
  color: var(--ll-ink-muted);
  letter-spacing: 0.04em;
}

.label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ll-ink-muted);
  margin: 0.25rem 0 0;
}

.sub-label {
  margin-top: 0.5rem;
}

input,
select {
  font-family: var(--ll-font-sans);
  font-size: 0.8125rem;
  padding: 0.25rem 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--ll-ink-faint);
  color: var(--ll-ink);
  font-feature-settings:
    'tnum' 1,
    'lnum' 1;
  font-variant-numeric: tabular-nums lining-nums;
  min-width: 0;
}

input:focus,
select:focus {
  outline: none;
  border-bottom: 2px solid var(--ll-accent);
  padding-bottom: calc(0.25rem - 1px);
}

.empty {
  font-family: var(--ll-font-serif);
  font-size: 0.8125rem;
  color: var(--ll-ink-muted);
  margin: 0;
}

.mutation-row {
  display: flex;
  gap: 0.375rem;
  align-items: center;
  flex-wrap: wrap;
}

.mutation-row select {
  flex: 1 1 100%;
  font-size: 0.75rem;
}

.mutation-row input {
  flex: 1 1 auto;
  min-width: 70px;
  font-size: 0.75rem;
}

.suffix {
  font-size: 0.75rem;
  color: var(--ll-ink-muted);
}

button.remove-mutation {
  background: transparent;
  border: none;
  color: var(--ll-ink-muted);
  font-size: 1rem;
  cursor: pointer;
  padding: 0 0.25rem;
  line-height: 1;
}

button.remove-mutation:hover {
  color: var(--ll-negative);
}

button.add-sub {
  background: transparent;
  border: none;
  color: var(--ll-accent);
  font-family: inherit;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.25rem 0;
  align-self: flex-start;
}

button.add-sub:hover {
  color: var(--ll-accent-hover);
  text-decoration: underline;
}
</style>
