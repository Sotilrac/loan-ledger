import { defineStore } from 'pinia';
import { ref } from 'vue';
import { settingsApi } from '../source/ocsSettingsApi.js';

const DEFAULT_FOLDER = '/Ledgers';

function readInitialFolders(): string[] {
  const w = window as unknown as {
    OCP?: { InitialState?: { loadState: (app: string, key: string) => unknown } };
  };
  const raw = w.OCP?.InitialState?.loadState?.('loanledger', 'folder');
  if (typeof raw === 'string' && raw.trim() !== '') return [raw];
  return [DEFAULT_FOLDER];
}

export const useSettingsStore = defineStore('settings', () => {
  const folders = ref<string[]>(readInitialFolders());
  const saving = ref<boolean>(false);
  const creating = ref<boolean>(false);

  async function refresh(): Promise<void> {
    const data = await settingsApi.get();
    folders.value = data.folders.length > 0 ? data.folders : [DEFAULT_FOLDER];
  }

  async function setFolders(next: string[]): Promise<void> {
    saving.value = true;
    try {
      const data = await settingsApi.set(next);
      folders.value = data.folders.length > 0 ? data.folders : [DEFAULT_FOLDER];
    } finally {
      saving.value = false;
    }
  }

  async function createFolder(path: string): Promise<void> {
    creating.value = true;
    try {
      await settingsApi.createFolder(path);
    } finally {
      creating.value = false;
    }
  }

  return { folders, saving, creating, refresh, setFolders, createFolder };
});
