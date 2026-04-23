import type { CsvMapping } from '@loan-ledger/core';
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const STORAGE_KEY = '@loan-ledger/web:mappings';

function loadFromStorage(): CsvMapping[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CsvMapping[];
  } catch {
    return [];
  }
}

function saveToStorage(mappings: CsvMapping[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch {
    /* quota or private mode — swallow */
  }
}

export const useMappingsStore = defineStore('mappings', () => {
  const mappings = ref<CsvMapping[]>(loadFromStorage());

  watch(
    mappings,
    (next) => {
      saveToStorage(next);
    },
    { deep: true },
  );

  function upsert(mapping: CsvMapping): void {
    const idx = mappings.value.findIndex((m) => m.name === mapping.name);
    if (idx >= 0) mappings.value[idx] = mapping;
    else mappings.value = [...mappings.value, mapping];
  }

  function remove(name: string): void {
    mappings.value = mappings.value.filter((m) => m.name !== name);
  }

  function getByName(name: string): CsvMapping | undefined {
    return mappings.value.find((m) => m.name === name);
  }

  return { mappings, upsert, remove, getByName };
});
