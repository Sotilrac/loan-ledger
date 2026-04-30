import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '../source/ocsSettingsApi.js';

function readInitialFolder(): string {
  const w = window as unknown as {
    OCP?: { InitialState?: { loadState: (app: string, key: string) => unknown } };
  };
  const raw = w.OCP?.InitialState?.loadState?.('loanledger', 'folder');
  return typeof raw === 'string' && raw.trim() !== '' ? raw : '/Ledgers';
}

export const useSettingsStore = defineStore('settings', () => {
  const folder = ref<string>(readInitialFolder());
  const saving = ref<boolean>(false);

  async function setFolder(next: string): Promise<void> {
    saving.value = true;
    try {
      const data = await settingsApi.set(next);
      folder.value = data.folder;
    } finally {
      saving.value = false;
    }
  }

  return { folder, saving, setFolder };
});
