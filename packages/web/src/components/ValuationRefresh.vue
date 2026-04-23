<script setup lang="ts">
import { todayISO } from '@loan-ledger/core';
import { ref } from 'vue';
import { useLoanStore } from '../stores/loan.js';

const store = useLoanStore();

const state = ref<'idle' | 'fetching' | 'error'>('idle');
const error = ref<string | null>(null);

/**
 * Minimal CustomURL valuation: fetch the configured URL, accept either a bare
 * number or an object like `{ amount: <number> }` as the response body. This
 * keeps Phase 6 useful without locking us into a specific provider shape.
 */
async function refresh() {
  const url = store.activeLoan.valuation.current.url;
  if (!url) {
    error.value = 'No URL set on the custom valuation source';
    state.value = 'error';
    return;
  }
  state.value = 'fetching';
  error.value = null;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const amount = parseAmount(text);
    if (amount === null) throw new Error('Response did not contain a number');
    // Write directly to loan (not via draft) since this is a live refresh,
    // not a user edit.
    store.loan = {
      ...store.loan,
      valuation: {
        ...store.loan.valuation,
        current: {
          ...store.loan.valuation.current,
          amount,
          as_of: todayISO(),
        },
      },
    };
    state.value = 'idle';
  } catch (err) {
    state.value = 'error';
    error.value = err instanceof Error ? err.message : 'Refresh failed';
  }
}

function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) return asNumber;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'amount' in parsed &&
      typeof (parsed as { amount: unknown }).amount === 'number'
    ) {
      return (parsed as { amount: number }).amount;
    }
  } catch {
    return null;
  }
  return null;
}
</script>

<template>
  <div v-if="store.activeLoan.valuation.current.source === 'custom_url'" class="refresh">
    <button type="button" class="link" :disabled="state === 'fetching'" @click="refresh">
      {{ state === 'fetching' ? 'Refreshing…' : 'Refresh valuation' }}
    </button>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.refresh {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
}

.link {
  background: transparent;
  border: none;
  color: var(--ll-accent);
  font-family: var(--ll-font-sans);
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.link:hover:not(:disabled) {
  color: var(--ll-accent-hover);
}

.link:disabled {
  color: var(--ll-ink-muted);
  cursor: not-allowed;
}

.error {
  color: var(--ll-negative);
  margin: 0;
}
</style>
