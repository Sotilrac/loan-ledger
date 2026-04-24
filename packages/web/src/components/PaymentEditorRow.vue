<script setup lang="ts">
import type { LedgerRow, Payment } from '@loan-ledger/core';
import { PhTrash, PhX } from '@phosphor-icons/vue';
import { reactive } from 'vue';
import { useLoanStore } from '../stores/loan.js';

const props = defineProps<{ row: LedgerRow }>();
const emit = defineEmits<{ close: [] }>();

const store = useLoanStore();

interface EditForm {
  amount: number;
  principal: number | '';
  interest: number | '';
  escrow: number | '';
  extra: number | '';
  note: string;
}

const form = reactive<EditForm>(seedForm());

function seedForm(): EditForm {
  const p = store.activeLoan.payments?.find((pp) => pp.date === props.row.date);
  if (p) {
    return {
      amount: p.amount,
      principal: p.principal ?? '',
      interest: p.interest ?? '',
      escrow: p.escrow ?? '',
      extra: p.extra ?? '',
      note: p.note ?? '',
    };
  }
  // New payment seeded from the scheduled values.
  const s = props.row.scheduled;
  return {
    amount: round2(s.payment + s.escrow),
    principal: '',
    interest: '',
    escrow: '',
    extra: '',
    note: '',
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function onSave() {
  const payment: Payment = {
    date: props.row.date,
    amount: round2(Number(form.amount)),
  };
  const opt = (v: number | ''): number | undefined =>
    v === '' || Number.isNaN(Number(v)) ? undefined : round2(Number(v));
  const principal = opt(form.principal);
  const interest = opt(form.interest);
  const escrow = opt(form.escrow);
  const extra = opt(form.extra);
  if (principal !== undefined) payment.principal = principal;
  if (interest !== undefined) payment.interest = interest;
  if (escrow !== undefined) payment.escrow = escrow;
  if (extra !== undefined) payment.extra = extra;
  const note = form.note.trim();
  if (note) payment.note = note;
  store.upsertPayment(payment);
  emit('close');
}

function onDelete() {
  store.deletePayment(props.row.date);
  emit('close');
}
</script>

<template>
  <tr class="edit-row">
    <td colspan="8">
      <form class="payment-editor" @submit.prevent="onSave">
        <p class="editor-title">
          {{ row.actual ? 'Edit payment' : 'Add payment' }} — {{ row.date }}
        </p>
        <div class="editor-grid">
          <label>
            <span>Amount</span>
            <input v-model.number="form.amount" type="number" step="0.01" min="0" />
          </label>
          <label>
            <span>Principal</span>
            <input
              v-model.number="form.principal"
              type="number"
              step="0.01"
              min="0"
              placeholder="auto"
            />
          </label>
          <label>
            <span>Interest</span>
            <input
              v-model.number="form.interest"
              type="number"
              step="0.01"
              min="0"
              placeholder="auto"
            />
          </label>
          <label>
            <span>Escrow</span>
            <input
              v-model.number="form.escrow"
              type="number"
              step="0.01"
              min="0"
              placeholder="auto"
            />
          </label>
          <label>
            <span>Extra</span>
            <input v-model.number="form.extra" type="number" step="0.01" min="0" placeholder="0" />
          </label>
          <label class="grow">
            <span>Note</span>
            <input v-model="form.note" type="text" placeholder="optional" />
          </label>
        </div>
        <div class="editor-actions">
          <button type="submit" class="save">Save</button>
          <button v-if="row.actual" type="button" class="delete" @click="onDelete">
            <PhTrash :size="12" weight="regular" /> Delete
          </button>
          <button type="button" class="cancel" @click="emit('close')">
            <PhX :size="12" weight="regular" /> Cancel
          </button>
        </div>
      </form>
    </td>
  </tr>
</template>

<style scoped>
.edit-row td {
  background: var(--ll-paper-sunk) !important;
  padding: 0.75rem 1rem !important;
  border-bottom: 2px solid var(--ll-ink-faint);
}

.payment-editor {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.editor-title {
  margin: 0;
  font-family: var(--ll-font-serif);
  font-size: 0.875rem;
}

.editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 0.5rem 0.75rem;
}

.editor-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  font-size: 0.6875rem;
  color: var(--ll-ink-muted);
  letter-spacing: 0.04em;
}

.editor-grid label.grow {
  grid-column: span 2;
}

.editor-grid input {
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

.editor-grid input:focus {
  outline: none;
  border-bottom: 2px solid var(--ll-accent);
  padding-bottom: calc(0.25rem - 1px);
}

.editor-actions {
  display: flex;
  gap: 0.5rem;
}

.editor-actions button {
  font-family: var(--ll-font-sans);
  font-size: 0.75rem;
  padding: 0.375rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.editor-actions .save {
  background: var(--ll-accent);
  color: #fff;
}

.editor-actions .save:hover {
  background: var(--ll-accent-hover);
}

.editor-actions .delete {
  background: transparent;
  color: var(--ll-negative);
}

.editor-actions .delete:hover {
  background: var(--ll-negative-soft);
}

.editor-actions .cancel {
  background: transparent;
  color: var(--ll-ink-muted);
}

.editor-actions .cancel:hover {
  color: var(--ll-ink);
}
</style>
