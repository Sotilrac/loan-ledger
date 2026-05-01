import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { OcsError } from '../api/ocs.js';
import { OcsLoanRegistry, type OcsLoanListEntry } from '../source/ocsLoanRegistry.js';

const registry = new OcsLoanRegistry();
const STORAGE_KEY = 'loanledger:nc:last-fileid';

export type LoanListError =
  | { kind: 'folder_missing'; message: string }
  | { kind: 'unknown'; message: string };

function readPersistedSelection(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function persistSelection(fileId: number | null): void {
  try {
    if (fileId === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(fileId));
  } catch {
    /* private mode / quota — ignore */
  }
}

export const useLoansStore = defineStore('loans', () => {
  const entries = ref<OcsLoanListEntry[]>([]);
  const error = ref<LoanListError | null>(null);
  const loading = ref<boolean>(false);
  const selectedFileId = ref<number | null>(readPersistedSelection());

  watch(selectedFileId, (id) => persistSelection(id));

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      entries.value = await registry.list();
      // If the persisted selection no longer points at a known loan, clear it.
      if (selectedFileId.value !== null && !getById(selectedFileId.value)) {
        selectedFileId.value = entries.value[0]?.fileid ?? null;
      } else if (selectedFileId.value === null && entries.value.length > 0) {
        selectedFileId.value = entries.value[0]!.fileid;
      }
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

  function select(fileId: number | null): void {
    selectedFileId.value = fileId;
  }

  /**
   * Create a new loan from the demo data with the given display name. The
   * server slugs the name into a file path inside the configured ledgers
   * folder. On success the list is refreshed and the new loan is selected.
   */
  async function create(name: string, contentYaml: string): Promise<number> {
    const created = await registry.create(name, contentYaml);
    await refresh();
    selectedFileId.value = created.fileid;
    return created.fileid;
  }

  return { entries, error, loading, selectedFileId, refresh, getById, select, create };
});
