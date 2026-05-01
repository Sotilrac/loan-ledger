<script setup lang="ts">
import { buildDemoLoan, serializeLoanYaml } from '@loan-ledger/core';
import { useLoanStore } from '@loan-ledger/ui';
import { computed, onMounted, ref } from 'vue';
import LoanDetail from './views/LoanDetail.vue';
import { useLoansStore } from './stores/loans.js';
import { useSettingsStore } from './stores/settings.js';

const loansStore = useLoansStore();
const settings = useSettingsStore();
const loan = useLoanStore();

const importOpen = ref(false);
const settingsOpen = ref(false);
const folderDraft = ref<string>(settings.folder);
const settingsError = ref<string>('');
const newError = ref<string>('');

const hasLoans = computed(() => loansStore.entries.length > 0);
const folderMissing = computed(() => loansStore.error?.kind === 'folder_missing');

onMounted(async () => {
  await loansStore.refresh();
  folderDraft.value = settings.folder;
});

async function onSelect(event: Event): Promise<void> {
  const target = event.target as HTMLSelectElement;
  const value = target.value;
  if (value === '__new__') {
    target.value = String(loansStore.selectedFileId ?? '');
    await onNew();
    return;
  }
  loansStore.select(value ? Number(value) : null);
}

async function onNew(): Promise<void> {
  newError.value = '';
  const name = window.prompt('Name for the new loan?', 'New loan');
  if (!name || !name.trim()) return;
  const yaml = serializeLoanYaml(buildDemoLoan());
  try {
    await loansStore.create(name.trim(), yaml);
  } catch (err) {
    newError.value = err instanceof Error ? err.message : String(err);
  }
}

async function onSaveFolder(): Promise<void> {
  settingsError.value = '';
  if (!folderDraft.value.trim()) return;
  try {
    await settings.setFolder(folderDraft.value.trim());
    folderDraft.value = settings.folder;
    await loansStore.refresh();
    settingsOpen.value = false;
  } catch (err) {
    settingsError.value = err instanceof Error ? err.message : String(err);
  }
}

async function onSave(): Promise<void> {
  await loan.save();
}
</script>

<template>
  <div class="ll-shell">
    <header class="ll-header">
      <p class="eyebrow">
        Loan Ledger
        <span class="by">
          by
          <a href="https://asmat.ca" target="_blank" rel="noopener noreferrer">Carlos Asmat</a>
        </span>
      </p>

      <div class="ll-header__controls">
        <template v-if="!loan.isEditing">
          <select
            class="ll-select"
            :value="loansStore.selectedFileId ?? ''"
            data-tooltip="Open one of the loans in your Ledgers folder, or create a new one"
            @change="onSelect"
          >
            <option v-if="!hasLoans" value="" disabled>No loans yet</option>
            <option v-for="entry in loansStore.entries" :key="entry.fileid" :value="entry.fileid">
              {{ entry.path.split('/').pop() }}
            </option>
            <option value="__new__">+ New loan…</option>
          </select>

          <button
            v-if="loansStore.selectedFileId !== null"
            type="button"
            class="ll-btn"
            @click="loan.startEditing"
          >
            Edit
          </button>
          <button
            v-if="loansStore.selectedFileId !== null"
            type="button"
            class="ll-btn"
            @click="importOpen = true"
          >
            Import payments
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            class="ll-btn ll-btn--primary"
            :disabled="loan.saveState === 'saving'"
            @click="onSave"
          >
            {{ loan.saveState === 'saving' ? 'Saving…' : 'Save' }}
          </button>
          <button type="button" class="ll-btn" @click="loan.cancelEditing">Cancel</button>
        </template>

        <div class="ll-settings">
          <button
            type="button"
            class="ll-btn"
            :aria-expanded="settingsOpen"
            @click="settingsOpen = !settingsOpen"
          >
            Settings
          </button>
          <div v-if="settingsOpen" class="ll-settings__panel">
            <label class="ll-settings__field">
              <span class="label">Ledgers folder</span>
              <input v-model="folderDraft" type="text" placeholder="/Ledgers" />
            </label>
            <p class="caption">
              Path inside your Nextcloud where <code>*.loan.yaml</code> files live. The folder is
              never auto-created — make sure it exists in the Files app first.
            </p>
            <p v-if="settingsError" class="ll-error" style="margin: 0">{{ settingsError }}</p>
            <div class="ll-settings__actions">
              <button
                type="button"
                class="ll-btn ll-btn--primary"
                :disabled="
                  settings.saving || folderDraft === settings.folder || !folderDraft.trim()
                "
                @click="onSaveFolder"
              >
                {{ settings.saving ? 'Saving…' : 'Save' }}
              </button>
              <button type="button" class="ll-btn" @click="settingsOpen = false">Close</button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="ll-main">
      <div v-if="loansStore.loading" class="ll-empty">Loading loans…</div>

      <div v-else-if="folderMissing" class="ll-error ll-error--block">
        <p>
          The folder <code>{{ settings.folder }}</code> doesn't exist in your Nextcloud.
        </p>
        <p>
          Create it in the Files app, or change the path under Settings, then the list will refresh.
        </p>
      </div>

      <div v-else-if="loansStore.error" class="ll-error ll-error--block">
        Couldn't load loans: {{ loansStore.error.message }}
      </div>

      <div v-else-if="!hasLoans" class="ll-empty ll-empty--centered">
        <p>
          No loans found in <code>{{ settings.folder }}</code> yet.
        </p>
        <p v-if="newError" class="ll-error" style="margin: 0.5rem 0 0">{{ newError }}</p>
        <button type="button" class="ll-btn ll-btn--primary" @click="onNew">
          New loan with demo data
        </button>
      </div>

      <LoanDetail
        v-else-if="loansStore.selectedFileId !== null"
        :file-id="loansStore.selectedFileId"
        :import-open="importOpen"
        @close-import="importOpen = false"
      />
    </main>
  </div>
</template>

<style scoped>
.ll-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem 0;
  flex: none;
  flex-wrap: wrap;
}

.ll-header__controls {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.ll-select {
  font: inherit;
  padding: 0.375rem 2rem 0.375rem 0.75rem;
  border: 1px solid var(--ll-ink-faint);
  border-radius: 4px;
  background-color: var(--ll-paper-raised, #fff);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 0.75rem;
  color: inherit;
  max-width: 18rem;
  appearance: none;
  cursor: pointer;
}

.ll-select:hover,
.ll-select:focus {
  border-color: var(--ll-accent);
}

.ll-settings {
  position: relative;
}

.ll-settings__panel {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  z-index: 10;
  min-width: 18rem;
  padding: 0.875rem;
  background: var(--ll-paper-raised, #fff);
  border: 1px solid var(--ll-ink-faint);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgb(var(--ll-shadow-rgb) / 12%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ll-settings__field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.ll-settings__field input {
  font: inherit;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--ll-ink-faint);
  border-radius: 4px;
  background: transparent;
  color: inherit;
}

.ll-settings__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.ll-main {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 1.25rem 1rem;
  box-sizing: border-box;
}

.ll-empty--centered {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
}

.ll-error--block {
  padding: 1rem;
  border-radius: 6px;
}
</style>
