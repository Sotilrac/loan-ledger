<script setup lang="ts">
import { ref } from 'vue';
import { pickLoanFile, readFile } from '../composables/useFileHandle.js';
import { useLoanStore } from '../stores/loan.js';

const store = useLoanStore();
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

async function openViaFSA() {
  error.value = null;
  const opened = await pickLoanFile();
  if (!opened) return;
  if (!store.openFromText(opened, 'fsa')) {
    error.value = 'File failed validation — see banner below.';
  }
}

function openFallback() {
  error.value = null;
  fileInput.value?.click();
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const opened = await readFile(file);
  if (!store.openFromText(opened, 'fallback')) {
    error.value = 'File failed validation — see banner below.';
  }
  input.value = '';
}
</script>

<template>
  <div class="picker">
    <button v-if="store.fsaAvailable" type="button" class="primary" @click="openViaFSA">
      Open a .loan.yaml
    </button>
    <button v-else type="button" class="primary" @click="openFallback">Choose a .loan.yaml</button>
    <button type="button" class="tertiary" @click="store.loadDemo">Use demo data</button>
    <input
      ref="fileInput"
      type="file"
      accept=".yaml,.yml,application/x-yaml"
      hidden
      @change="onFileChosen"
    />
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  gap: 0.75rem;
  align-items: center;
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

.primary:hover {
  background: var(--ll-accent-hover);
}

.tertiary {
  background: transparent;
  color: var(--ll-ink-soft);
  border: none;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.tertiary:hover {
  color: var(--ll-ink);
}

.error {
  color: var(--ll-negative);
  font-size: 0.875rem;
  margin: 0 0 0 0.5rem;
}
</style>
