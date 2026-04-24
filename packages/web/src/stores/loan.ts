import type {
  LoanComputation,
  LoanFile,
  LoanSource,
  Payment,
  ScenarioEvaluation,
} from '@loan-ledger/core';
import {
  buildDemoLoan,
  computeLoan,
  evaluateAllScenarios,
  parseLoanYaml,
  serializeLoanYaml,
  todayISO,
} from '@loan-ledger/core';
import { defineStore } from 'pinia';
import { computed, ref, shallowRef } from 'vue';
import { downloadText, fsaSupported } from '../composables/useFileHandle.js';
import { DemoSource } from '../source/demoSource.js';

export const useLoanStore = defineStore('loan', () => {
  // --- Source + loan state --------------------------------------------------
  const source = shallowRef<LoanSource>(new DemoSource());
  const loan = shallowRef<LoanFile>(buildDemoLoan());

  const lastSavedYaml = ref<string>(serializeLoanYaml(loan.value));
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

  /** Which scenario is open in inline-edit mode in the sidebar (null = none). */
  const editingScenarioId = ref<string | null>(null);

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

  /**
   * Interest saved *so far* by paying above scheduled. Simply the gap between
   * what the contract would have charged over the months you've actually
   * paid, vs. what actually accrued on your accelerated balance path.
   */
  const interestSavedByExtras = computed<number>(() => {
    const s = computation.value.summary;
    const diff = s.scheduled_interest_to_date - s.actual_interest_to_date;
    return Math.max(0, Math.round(diff * 100) / 100);
  });

  /**
   * First month where the scheduled principal portion reaches (or exceeds) the
   * scheduled interest portion. Null when that's already true at period 1:
   * for very-low-rate loans the crossover is trivial and adds no signal.
   */
  const crossoverPeriod = computed<number | null>(() => {
    const rows = computation.value.ledger;
    const hit = rows.find((r) => r.scheduled.principal >= r.scheduled.interest);
    if (!hit || hit.period === 1) return null;
    return hit.period;
  });

  const currentYaml = computed<string>(() => serializeLoanYaml(activeLoan.value));

  const hasUnsavedChanges = computed<boolean>(() => currentYaml.value !== lastSavedYaml.value);

  const canWriteToFile = computed<boolean>(() => source.value.canWrite);
  const fileName = computed<string>(() => source.value.name);

  // --- Actions --------------------------------------------------------------

  function loadDemo(): void {
    // Bypass the async attachSource path so the demo is available synchronously
    // on mount and "Use demo data" resets state without a round-trip through
    // parseLoanYaml.
    loan.value = buildDemoLoan();
    source.value = new DemoSource();
    lastSavedYaml.value = serializeLoanYaml(loan.value);
    validationErrors.value = [];
    isEditing.value = false;
    draft.value = null;
    selectedPeriod.value = null;
  }

  /**
   * Attach a new source and load its current YAML. Returns true on success;
   * validation failures leave the previous loan visible with an error banner.
   */
  async function attachSource(newSource: LoanSource): Promise<boolean> {
    const yaml = await newSource.read();
    const result = parseLoanYaml(yaml);
    if (!result.ok) {
      validationErrors.value = result.errors;
      return false;
    }
    loan.value = result.value;
    source.value = newSource;
    lastSavedYaml.value = yaml;
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
      if (source.value.canWrite) {
        await source.value.write(yaml);
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

  function toggleEditingScenario(id: string): void {
    editingScenarioId.value = editingScenarioId.value === id ? null : id;
  }

  /**
   * Mutate the current committed loan directly (not through the edit draft).
   * Used for inline edits (scenarios, quick changes) that shouldn't require
   * entering global Edit mode.
   */
  function updateLoan(mutator: (l: LoanFile) => void): void {
    const next = structuredClone(loan.value);
    mutator(next);
    loan.value = next;
  }

  /**
   * Merge imported payments into the current loan. Multiple rows on the same
   * date, both within a single CSV (a regular payment + a principal-only row)
   * and across imports (two filtered passes from the same bank export), are
   * summed rather than replaced: amounts add, principal/interest/escrow/extra
   * fields add, notes concatenate.
   */
  function importPayments(imported: Payment[]): number {
    if (imported.length === 0) return 0;
    const byDate = new Map<string, Payment>();
    for (const p of loan.value.payments ?? []) byDate.set(p.date, { ...p });
    for (const p of imported) {
      const existing = byDate.get(p.date);
      byDate.set(p.date, existing ? mergePayments(existing, p) : { ...p });
    }
    const merged = Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
    loan.value = { ...loan.value, payments: merged };
    return imported.length;
  }

  /** Upsert a single payment by date. Replaces any existing entry with the same date. */
  function upsertPayment(payment: Payment): void {
    updateLoan((l) => {
      const list = (l.payments ??= []);
      const idx = list.findIndex((p) => p.date === payment.date);
      if (idx >= 0) list[idx] = payment;
      else list.push(payment);
      list.sort((a, b) => (a.date < b.date ? -1 : 1));
    });
  }

  function deletePayment(date: string): void {
    updateLoan((l) => {
      if (!l.payments) return;
      const remaining = l.payments.filter((p) => p.date !== date);
      if (remaining.length === 0) delete l.payments;
      else l.payments = remaining;
    });
  }

  function mergePayments(a: Payment, b: Payment): Payment {
    const round2 = (n: number): number => Math.round(n * 100) / 100;
    const sum = (x: number | undefined, y: number | undefined): number | undefined => {
      if (x === undefined && y === undefined) return undefined;
      return round2((x ?? 0) + (y ?? 0));
    };
    const notes = [a.note, b.note].filter((n): n is string => !!n);
    const merged: Payment = {
      date: a.date,
      amount: round2(a.amount + b.amount),
    };
    const principal = sum(a.principal, b.principal);
    if (principal !== undefined) merged.principal = principal;
    const interest = sum(a.interest, b.interest);
    if (interest !== undefined) merged.interest = interest;
    const escrow = sum(a.escrow, b.escrow);
    if (escrow !== undefined) merged.escrow = escrow;
    const extra = sum(a.extra, b.extra);
    if (extra !== undefined) merged.extra = extra;
    if (notes.length > 0) merged.note = notes.join(' · ');
    return merged;
  }

  /**
   * Always-available export: writes the current loan YAML to a download,
   * independent of the attached source. Use this as "Save as".
   */
  function downloadYaml(): void {
    if (isEditing.value) commitEditing();
    const yaml = currentYaml.value;
    const slug =
      activeLoan.value.property.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'loan';
    downloadText(`${slug}.loan.yaml`, yaml);
  }

  return {
    // state
    loan,
    source,
    validationErrors,
    isEditing,
    draft,
    selectedPeriod,
    activeScenarioId,
    editingScenarioId,
    saveState,
    saveError,
    today,
    // computed
    activeLoan,
    computation,
    scenarios,
    activeScenarios,
    interestSavedByExtras,
    crossoverPeriod,
    currentYaml,
    hasUnsavedChanges,
    canWriteToFile,
    fileName,
    // capabilities
    fsaAvailable: fsaSupported(),
    // actions
    loadDemo,
    attachSource,
    startEditing,
    cancelEditing,
    commitEditing,
    updateDraft,
    save,
    downloadYaml,
    setSelectedPeriod,
    toggleScenario,
    toggleEditingScenario,
    updateLoan,
    importPayments,
    upsertPayment,
    deletePayment,
  };
});
