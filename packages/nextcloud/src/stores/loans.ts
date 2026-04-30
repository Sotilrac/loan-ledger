import { defineStore } from 'pinia';
import { ref } from 'vue';
import { OcsError } from '../api/ocs.js';
import { OcsLoanRegistry, type OcsLoanListEntry } from '../source/ocsLoanRegistry.js';

const registry = new OcsLoanRegistry();

export type LoanListError =
  | { kind: 'folder_missing'; message: string }
  | { kind: 'unknown'; message: string };

export const useLoansStore = defineStore('loans', () => {
  const entries = ref<OcsLoanListEntry[]>([]);
  const error = ref<LoanListError | null>(null);
  const loading = ref<boolean>(false);

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await registry.list();
    } catch (err) {
      if (err instanceof OcsError && err.code === 'folder_missing') {
        error.value = { kind: 'folder_missing', message: err.message };
        entries.value = [];
      } else {
        error.value = {
          kind: 'unknown',
          message: err instanceof Error ? err.message : String(err),
        };
        entries.value = [];
      }
    } finally {
      loading.value = false;
    }
  }

  function getById(fileId: number): OcsLoanListEntry | undefined {
    return entries.value.find((e) => e.fileid === fileId);
  }

  return { entries, error, loading, refresh, getById };
});
