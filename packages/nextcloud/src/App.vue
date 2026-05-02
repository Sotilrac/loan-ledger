<script setup lang="ts">
import { buildDemoLoan, serializeLoanYaml } from '@loan-ledger/core';
import { useLoanStore } from '@loan-ledger/ui';
import { computed, onMounted, ref, watch } from 'vue';
import LoanDetail from './views/LoanDetail.vue';
import { useLoansStore } from './stores/loans.js';
import { useSettingsStore } from './stores/settings.js';

const loansStore = useLoansStore();
const settings = useSettingsStore();
const loan = useLoanStore();

const importOpen = ref(false);
const settingsOpen = ref(false);
const folderDrafts = ref<string[]>([...settings.folders]);
const settingsError = ref<string>('');
const newError = ref<string>('');
const folderCreateError = ref<string>('');

const hasLoans = computed(() => loansStore.entries.length > 0);
const folderMissing = computed(() => loansStore.error?.kind === 'folder_missing');
const multipleFolders = computed(() => settings.folders.length > 1);

/**
 * Display label for a loan in the dropdown. When the user has only one
 * configured folder, show just the basename. With multiple folders,
 * include the folder context so the same `home.loan.yaml` in two
 * locations isn't ambiguous.
 */
function entryLabel(path: string): string {
  const basename = (path.split('/').pop() ?? path).replace(/\.loan\.yaml$/, '');
  if (!multipleFolders.value) return basename;
  for (const folder of settings.folders) {
    const prefix = `/${folder.replace(/^\/+/, '')}`;
    if (path.indexOf(prefix + '/') >= 0) {
      return `${prefix.slice(1)} / ${basename}`;
    }
  }
  return basename;
}

watch(
  () => settings.folders,
  (next) => {
    if (!settingsOpen.value) folderDrafts.value = [...next];
  },
  { deep: true },
);

onMounted(async () => {
  await settings.refresh();
  folderDrafts.value = [...settings.folders];
  await loansStore.refresh();
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

/**
 * NC's prompt dialog. Falls back to `window.prompt` if NC's chrome isn't
 * loaded (e.g. running outside Nextcloud during tests).
 */
function ncPrompt(text: string, title: string, defaultValue = ''): Promise<string | null> {
  const w = window as unknown as {
    OC?: {
      dialogs?: {
        prompt?: (
          text: string,
          title: string,
          callback: (ok: boolean, value: string) => void,
          modal: boolean,
          name: string,
          password: boolean,
        ) => void;
      };
    };
  };
  const dialogs = w.OC?.dialogs;
  if (!dialogs?.prompt) {
    const fallback = window.prompt(text, defaultValue);
    return Promise.resolve(fallback);
  }
  return new Promise((resolve) => {
    dialogs.prompt!(
      text,
      title,
      (ok, value) => resolve(ok ? value : null),
      true,
      defaultValue,
      false,
    );
  });
}

async function onNew(): Promise<void> {
  newError.value = '';

  // When multiple folders are configured, let the user pick which one the
  // new loan lands in. Single-folder users skip this step.
  let folder: string | null = null;
  if (settings.folders.length > 1) {
    folder = await pickFolder(settings.folders[0] ?? '/', 'Choose where to put the new loan');
    if (!folder) return;
  }

  const name = await ncPrompt('Name for the new loan?', 'New loan', 'New loan');
  if (!name || !name.trim()) return;

  const yaml = serializeLoanYaml(buildDemoLoan());
  try {
    await loansStore.create(name.trim(), yaml, folder);
  } catch (err) {
    newError.value = err instanceof Error ? err.message : String(err);
  }
}

async function onSave(): Promise<void> {
  await loan.save();
}

function addFolderRow(): void {
  folderDrafts.value = [...folderDrafts.value, ''];
}

function removeFolderRow(index: number): void {
  folderDrafts.value = folderDrafts.value.filter((_, i) => i !== index);
  if (folderDrafts.value.length === 0) folderDrafts.value = [''];
}

function updateFolderRow(index: number, value: string): void {
  folderDrafts.value = folderDrafts.value.map((existing, i) => (i === index ? value : existing));
}

async function onSaveFolders(): Promise<void> {
  settingsError.value = '';
  const cleaned = folderDrafts.value.map((s) => s.trim()).filter((s) => s !== '');
  try {
    await settings.setFolders(cleaned);
    folderDrafts.value = [...settings.folders];
    await loansStore.refresh();
    settingsOpen.value = false;
  } catch (err) {
    settingsError.value = err instanceof Error ? err.message : String(err);
  }
}

async function onCreateFolder(path: string): Promise<void> {
  folderCreateError.value = '';
  try {
    await settings.createFolder(path);
    await loansStore.refresh();
  } catch (err) {
    folderCreateError.value = err instanceof Error ? err.message : String(err);
  }
}

/**
 * Open Nextcloud's built-in file picker in folder-only mode and resolve to
 * the absolute path the user picks (or `null` if they cancel). Uses the
 * legacy `OC.dialogs.filepicker` global because it's the only one that's
 * always available without bundling `@nextcloud/dialogs`.
 */
function pickFolder(initial: string, title = 'Choose a folder'): Promise<string | null> {
  const w = window as unknown as {
    OC?: {
      dialogs?: {
        filepicker?: (
          title: string,
          callback: (path: string | null) => void,
          multiselect: boolean,
          mimetypeFilter: string | string[],
          modal: boolean,
          type?: number,
          startAt?: string,
        ) => void;
      };
    };
  };
  const dialogs = w.OC?.dialogs;
  if (!dialogs?.filepicker) return Promise.resolve(null);
  // Call as a method so `this` binds to `OC.dialogs` — the filepicker
  // implementation reads `this.FILEPICKER_TYPE_CUSTOM` internally.
  return new Promise((resolve) => {
    dialogs.filepicker!(
      title,
      (path) => resolve(path),
      false,
      'httpd/unix-directory',
      true,
      1,
      initial,
    );
  });
}

async function browseForFolderRow(index: number): Promise<void> {
  const current = folderDrafts.value[index] ?? '/';
  const picked = await pickFolder(current);
  if (picked) updateFolderRow(index, picked);
}

async function browseForOnboardPath(): Promise<void> {
  const picked = await pickFolder(settings.folders[0] ?? '/');
  if (!picked) return;
  folderCreateError.value = '';
  try {
    await settings.setFolders([picked]);
    await loansStore.refresh();
  } catch (err) {
    folderCreateError.value = err instanceof Error ? err.message : String(err);
  }
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

      <div v-if="!folderMissing" class="ll-header__controls">
        <template v-if="!loan.isEditing">
          <select
            class="ll-select"
            :value="loansStore.selectedFileId ?? ''"
            data-tooltip="Open one of the loans in your Ledgers folder, or create a new one"
            @change="onSelect"
          >
            <option v-if="!hasLoans" value="" disabled>No loans yet</option>
            <option v-for="entry in loansStore.entries" :key="entry.fileid" :value="entry.fileid">
              {{ entryLabel(entry.path) }}
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
          <button
            v-if="loansStore.selectedFileId !== null"
            type="button"
            class="ll-btn"
            title="Download the amortization table (scheduled + actuals) as CSV"
            @click="loan.downloadCsv"
          >
            Export CSV
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
            <p class="label">Ledgers folders</p>
            <p class="caption">
              Each folder is scanned for <code>*.loan.yaml</code> files. The first folder is also
              where new loans land and where the shared <code>.mappings.yaml</code> lives.
            </p>
            <p class="caption">
              Files in these folders are regular Nextcloud files. Rename, move, copy, or share them
              from the Files app, and the changes show up here on the next refresh.
            </p>

            <div v-for="(draft, i) in folderDrafts" :key="i" class="ll-settings__row">
              <input
                type="text"
                :value="draft"
                placeholder="/Ledgers"
                @input="updateFolderRow(i, ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                class="ll-btn ll-btn--ghost"
                aria-label="Browse"
                data-tooltip="Browse Nextcloud for a folder"
                @click="browseForFolderRow(i)"
              >
                Browse…
              </button>
              <button
                type="button"
                class="ll-btn ll-btn--ghost"
                aria-label="Remove folder"
                :disabled="folderDrafts.length === 1 && !draft.trim()"
                @click="removeFolderRow(i)"
              >
                ×
              </button>
            </div>

            <button
              type="button"
              class="ll-btn ll-btn--ghost ll-settings__add"
              @click="addFolderRow"
            >
              + Add folder
            </button>

            <p v-if="settingsError" class="ll-error" style="margin: 0">{{ settingsError }}</p>

            <div class="ll-settings__actions">
              <button
                type="button"
                class="ll-btn ll-btn--primary"
                :disabled="settings.saving"
                @click="onSaveFolders"
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

      <div v-else-if="folderMissing" class="ll-empty ll-empty--centered">
        <h2 class="ll-onboard__title">Welcome to Loan Ledger</h2>
        <p class="ll-onboard__lede">
          See where every payment really goes, watch your balance curve into the future, and run
          side-by-side scenarios to find the cheapest way to pay off your loan.
        </p>
        <p class="ll-onboard__lede ll-onboard__lede--muted">
          Loans are stored as plain <code>.loan.yaml</code> files in a folder of your choice. Share
          that folder in Nextcloud and a partner sees the same numbers, no extra account needed.
          <code>{{ settings.folders[0] }}</code> doesn't exist yet, so create it to start.
        </p>
        <p v-if="folderCreateError" class="ll-error" style="margin: 0.5rem 0 0">
          {{ folderCreateError }}
        </p>
        <div class="ll-empty__actions">
          <button
            type="button"
            class="ll-btn ll-btn--primary"
            :disabled="settings.creating"
            @click="onCreateFolder(settings.folders[0]!)"
          >
            {{ settings.creating ? 'Creating…' : `Create ${settings.folders[0]}` }}
          </button>
          <button type="button" class="ll-btn" @click="browseForOnboardPath">
            Or pick an existing folder…
          </button>
        </div>
      </div>

      <div v-else-if="loansStore.error" class="ll-error ll-error--block">
        Couldn't load loans: {{ loansStore.error.message }}
      </div>

      <div v-else-if="!hasLoans" class="ll-empty ll-empty--centered">
        <p>
          No loans found in
          <code>{{ settings.folders.join(', ') }}</code>
          yet.
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
  padding: 0.375rem 2.5rem 0.375rem 0.75rem;
  border: 1px solid var(--ll-ink-faint);
  border-radius: 4px;
  background-color: var(--ll-paper-raised, #fff);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' fill='none' stroke='%23666' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  background-size: 0.75rem;
  color: inherit;
  max-width: 22rem;
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
  min-width: 22rem;
  padding: 0.875rem;
  background: var(--ll-paper-raised, #fff);
  border: 1px solid var(--ll-ink-faint);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgb(var(--ll-shadow-rgb) / 12%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.ll-settings__row {
  display: flex;
  gap: 0.375rem;
  align-items: center;
}

.ll-settings__row input {
  flex: 1 1 auto;
  font: inherit;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--ll-ink-faint);
  border-radius: 4px;
  background: transparent;
  color: inherit;
}

.ll-settings__row input:focus {
  outline: none;
  border-color: var(--ll-accent);
}

.ll-settings__add {
  align-self: flex-start;
  padding: 0.25rem 0.5rem;
}

.ll-settings__actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

.ll-btn--ghost {
  background: transparent;
  border-color: transparent;
  color: var(--ll-ink-muted);
}

.ll-btn--ghost:hover:not(:disabled) {
  border-color: var(--ll-ink-faint);
  color: var(--ll-ink);
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

.ll-onboard__title {
  font-family: var(--ll-font-serif);
  font-size: 1.75rem;
  font-weight: 500;
  margin: 0;
}

.ll-onboard__lede {
  max-width: 36rem;
  color: var(--ll-ink-soft);
  margin: 0;
}

.ll-onboard__lede--muted {
  font-size: 0.875rem;
  color: var(--ll-ink-muted);
}

.ll-onboard__path {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.5rem;
}

.ll-onboard__path input {
  font: inherit;
  padding: 0.375rem 0.5rem;
  border: 1px solid var(--ll-ink-faint);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  min-width: 14rem;
}

.ll-onboard__path input:focus {
  outline: none;
  border-color: var(--ll-accent);
}

.ll-empty__actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.ll-error--block {
  padding: 1rem;
  border-radius: 6px;
}
</style>
