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
    <button
      type="button"
      class="primary"
      data-tooltip="Opens a .loan.yaml file from your computer. Nothing is uploaded — parsing and math run entirely in your browser."
      @click="store.fsaAvailable ? openViaFSA() : openFallback()"
    >
      Load loan
    </button>
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

.error {
  color: var(--ll-negative);
  font-size: 0.875rem;
  margin: 0 0 0 0.5rem;
}
</style>
