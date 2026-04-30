<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSettingsStore } from '../stores/settings.js';

const store = useSettingsStore();
const draft = ref<string>(store.folder);
const status = ref<'idle' | 'saving' | 'saved' | 'error'>('idle');
const errorMessage = ref<string>('');

watch(
  () => store.folder,
  (next) => {
    draft.value = next;
  },
);

async function save(): Promise<void> {
  if (!draft.value.trim()) return;
  status.value = 'saving';
  errorMessage.value = '';
  try {
    await store.setFolder(draft.value.trim());
    status.value = 'saved';
  } catch (err) {
    status.value = 'error';
    errorMessage.value = err instanceof Error ? err.message : String(err);
  }
}
</script>

<template>
  <section>
    <h2 style="margin-top: 0">Settings</h2>

    <form @submit.prevent="save">
      <label
        for="folder-input"
        style="display: flex; flex-direction: column; gap: 0.25rem; max-width: 32rem"
      >
        <span style="font-size: 0.875rem">Ledgers folder</span>
        <input
          id="folder-input"
          v-model="draft"
          type="text"
          placeholder="/Ledgers"
          style="padding: 0.5rem; border: 1px solid var(--color-border, #ccc); border-radius: 4px"
        />
        <small style="color: var(--color-text-maxcontrast, #888)">
          Path inside your Nextcloud. The app reads <code>*.loan.yaml</code> files from here. The
          folder is never auto-created.
        </small>
      </label>

      <div style="margin-top: 1rem; display: flex; gap: 0.75rem; align-items: center">
        <button
          type="submit"
          :disabled="status === 'saving' || !draft.trim() || draft === store.folder"
        >
          {{ status === 'saving' ? 'Saving…' : 'Save' }}
        </button>
        <span v-if="status === 'saved'" style="color: var(--color-success, #0a0)">Saved.</span>
        <span v-if="status === 'error'" class="ll-error" style="padding: 0.25rem 0.5rem">
          {{ errorMessage }}
        </span>
      </div>
    </form>
  </section>
</template>
