import type { LoanComputation, LoanFile, ScenarioEvaluation } from '@loan-ledger/core';
import {
  DEMO_LOAN,
  buildDemoLoan,
  computeLoan,
  evaluateAllScenarios,
  parseLoanYaml,
  serializeLoanYaml,
  todayISO,
} from '@loan-ledger/core';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import {
  downloadText,
  fsaSupported,
  requestWritePermission,
  writeToHandle,
  type FsaFileHandle,
  type OpenedFile,
} from '../composables/useFileHandle.js';

export type SourceType = 'demo' | 'fsa' | 'fallback';

export const useLoanStore = defineStore('loan', () => {
  // --- Loaded loan state ----------------------------------------------------
  const loan = shallowRef<LoanFile>(buildDemoLoan());
  const source = ref<SourceType>('demo');
  const fileName = ref<string>('demo.loan.yaml');
  const fsaHandle = shallowRef<FsaFileHandle | null>(null);

  const lastSavedYaml = ref<string>(serializeLoanYaml(DEMO_LOAN));
  const validationErrors = ref<{ path: string; message: string }[]>([]);

  // --- Edit state -----------------------------------------------------------
  const isEditing = ref(false);
  /** Draft of the loan used during edit mode. Committed back to `loan` on save. */
  const draft = shallowRef<LoanFile | null>(null);
  const saveState = ref<'idle' | 'saving' | 'error'>('idle');
  const saveError = ref<string | null>(null);

  // --- Selection / hover shared across charts and table --------------------
  const selectedPeriod = ref<number | null>(null);

  // --- Active scenario (for the chart overlay + card highlight) ------------
  const activeScenarioId = ref<string | null>(null);

  // --- Computed -------------------------------------------------------------
  const today = ref(todayISO());

  const activeLoan = computed<LoanFile>(() =>
    isEditing.value && draft.value ? draft.value : loan.value,
  );

  const computation = computed<LoanComputation>(() =>
    computeLoan(activeLoan.value, { today: today.value }),
  );

  const scenarios = computed<Map<string, ScenarioEvaluation>>(() =>
    evaluateAllScenarios(activeLoan.value, { today: today.value }),
  );

  /** Scenarios restricted to the currently-toggled one (for chart overlay). */
  const activeScenarios = computed<Map<string, ScenarioEvaluation>>(() => {
    if (!activeScenarioId.value) return new Map();
    const ev = scenarios.value.get(activeScenarioId.value);
    if (!ev) return new Map();
    return new Map([[activeScenarioId.value, ev]]);
  });

  const currentYaml = computed<string>(() => serializeLoanYaml(activeLoan.value));

  const hasUnsavedChanges = computed<boolean>(() => currentYaml.value !== lastSavedYaml.value);

  const canWriteToFile = computed<boolean>(() => source.value === 'fsa' && !!fsaHandle.value);

  // --- Actions --------------------------------------------------------------

  function loadDemo(): void {
    loan.value = buildDemoLoan();
    source.value = 'demo';
    fileName.value = 'demo.loan.yaml';
    fsaHandle.value = null;
    lastSavedYaml.value = serializeLoanYaml(loan.value);
    validationErrors.value = [];
    isEditing.value = false;
    draft.value = null;
    selectedPeriod.value = null;
  }

  function openFromText(opened: OpenedFile, sourceKind: SourceType): boolean {
    const result = parseLoanYaml(opened.text);
    if (!result.ok) {
      validationErrors.value = result.errors;
      return false;
    }
    loan.value = result.value;
    fileName.value = opened.name;
    source.value = sourceKind;
    fsaHandle.value = opened.handle;
    lastSavedYaml.value = opened.text;
    validationErrors.value = [];
    isEditing.value = false;
    draft.value = null;
    selectedPeriod.value = null;
    return true;
  }

  function startEditing(): void {
    if (isEditing.value) return;
    draft.value = structuredClone(loan.value);
    isEditing.value = true;
  }

  function cancelEditing(): void {
    draft.value = null;
    isEditing.value = false;
  }

  function commitEditing(): void {
    if (!draft.value) return;
    loan.value = draft.value;
    draft.value = null;
    isEditing.value = false;
  }

  /**
   * Mutate the current draft via an updater that receives a mutable clone.
   * The cloned result replaces `draft.value`, keeping Vue reactivity.
   */
  function updateDraft(mutator: (d: LoanFile) => void): void {
    if (!draft.value) return;
    const next = structuredClone(draft.value);
    mutator(next);
    draft.value = next;
  }

  async function save(): Promise<boolean> {
    if (isEditing.value) commitEditing();
    saveState.value = 'saving';
    saveError.value = null;
    try {
      const yaml = currentYaml.value;
      if (fsaHandle.value) {
        const granted = await requestWritePermission(fsaHandle.value);
        if (!granted) {
          throw new Error('Write permission denied');
        }
        await writeToHandle(fsaHandle.value, yaml);
      } else {
        downloadText(fileName.value, yaml);
      }
      lastSavedYaml.value = yaml;
      saveState.value = 'idle';
      return true;
    } catch (err) {
      saveState.value = 'error';
      saveError.value = err instanceof Error ? err.message : String(err);
      return false;
    }
  }

  function setSelectedPeriod(period: number | null): void {
    selectedPeriod.value = period;
  }

  function toggleScenario(id: string): void {
    activeScenarioId.value = activeScenarioId.value === id ? null : id;
  }

  return {
    // state
    loan,
    source,
    fileName,
    fsaHandle,
    validationErrors,
    isEditing,
    draft,
    selectedPeriod,
    activeScenarioId,
    saveState,
    saveError,
    today,
    // computed
    activeLoan,
    computation,
    scenarios,
    activeScenarios,
    currentYaml,
    hasUnsavedChanges,
    canWriteToFile,
    // capabilities
    fsaAvailable: fsaSupported(),
    // actions
    loadDemo,
    openFromText,
    startEditing,
    cancelEditing,
    commitEditing,
    updateDraft,
    save,
    setSelectedPeriod,
    toggleScenario,
  };
});
