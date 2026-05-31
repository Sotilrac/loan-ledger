<script setup lang="ts">
import { FallbackSource, useLoanStore } from '@loan-ledger/ui';
import { ref } from 'vue';
import { fsaSupported, pickLoanFile } from '../composables/useFileHandle.js';
import { FsaSource } from '../source/fsaSource.js';

const store = useLoanStore();
const fsaAvailable = fsaSupported();
const fileInput = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);

async function openViaFSA() {
  error.value = null;
  const opened = await pickLoanFile();
  if (!opened || !opened.handle) return;
  const ok = await store.attachSource(new FsaSource(opened.handle, opened.text));
  if (!ok) error.value = 'File failed validation, see banner below.';
}

function openFallback() {
  error.value = null;
  fileInput.value?.click();
}

async function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const text = await file.text();
  const ok = await store.attachSource(new FallbackSource(file.name, text));
  if (!ok) error.value = 'File failed validation, see banner below.';
  input.value = '';
}
</script>

<template>
  <div class="picker">
    <button
      type="button"
      class="primary"
      data-tooltip="Opens a .loan.yaml file from your computer. Nothing is uploaded, parsing and math run entirely in your browser."
      @click="fsaAvailable ? openViaFSA() : openFallback()"
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
  display: contents;
}

.error {
  color: var(--ll-negative);
  font-size: 0.875rem;
  margin: 0 0 0 0.5rem;
}
</style>
