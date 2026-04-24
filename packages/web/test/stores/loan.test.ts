import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLoanStore } from '../../src/stores/loan.js';

describe('useLoanStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with the demo loan attached as the current source', () => {
    const store = useLoanStore();
    expect(store.source.kind).toBe('demo');
    expect(store.canWriteToFile).toBe(false);
    expect(store.activeLoan.property.name).toContain('Maple');
    expect(store.hasUnsavedChanges).toBe(false);
  });

  describe('draft editing', () => {
    it('startEditing clones the loan into draft and cancelEditing discards it', () => {
      const store = useLoanStore();
      const originalName = store.activeLoan.property.name;
      store.startEditing();
      expect(store.isEditing).toBe(true);
      store.updateDraft((d) => {
        d.property.name = 'Changed';
      });
      expect(store.activeLoan.property.name).toBe('Changed');
      store.cancelEditing();
      expect(store.isEditing).toBe(false);
      expect(store.activeLoan.property.name).toBe(originalName);
    });

    it('commitEditing promotes the draft to the committed loan', () => {
      const store = useLoanStore();
      store.startEditing();
      store.updateDraft((d) => {
        d.property.name = 'Committed';
      });
      store.commitEditing();
      expect(store.isEditing).toBe(false);
      expect(store.activeLoan.property.name).toBe('Committed');
    });
  });

  describe('payment upsert/delete', () => {
    it('upsertPayment adds a new payment on a previously-unpaid date, sorted', () => {
      const store = useLoanStore();
      const date = '3000-01-01'; // Far future — no existing demo payment on this date.
      store.upsertPayment({ date, amount: 1000 });
      const payments = store.activeLoan.payments ?? [];
      const match = payments.find((p) => p.date === date);
      expect(match).toEqual({ date, amount: 1000 });
      // Payments stay date-sorted.
      const sorted = [...payments].sort((a, b) => (a.date < b.date ? -1 : 1));
      expect(payments).toEqual(sorted);
    });

    it('upsertPayment replaces an existing payment on the same date', () => {
      const store = useLoanStore();
      const original = store.activeLoan.payments?.[0];
      expect(original).toBeDefined();
      const date = original!.date;
      store.upsertPayment({ date, amount: 42, note: 'replaced' });
      const payments = store.activeLoan.payments ?? [];
      const occurrences = payments.filter((p) => p.date === date);
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]).toEqual({ date, amount: 42, note: 'replaced' });
    });

    it('deletePayment removes a payment by date and clears the array when empty', () => {
      const store = useLoanStore();
      const target = store.activeLoan.payments?.[0];
      expect(target).toBeDefined();
      store.deletePayment(target!.date);
      const remaining = store.activeLoan.payments ?? [];
      expect(remaining.some((p) => p.date === target!.date)).toBe(false);
    });
  });

  describe('scenario toggling', () => {
    it('toggleScenario flips an id on and off', () => {
      const store = useLoanStore();
      store.toggleScenario('extra-500');
      expect(store.activeScenarioId).toBe('extra-500');
      store.toggleScenario('extra-500');
      expect(store.activeScenarioId).toBe(null);
    });

    it('toggleScenario switches between distinct ids', () => {
      const store = useLoanStore();
      store.toggleScenario('a');
      store.toggleScenario('b');
      expect(store.activeScenarioId).toBe('b');
    });

    it('toggleEditingScenario is independent of activeScenarioId', () => {
      const store = useLoanStore();
      store.toggleScenario('a');
      store.toggleEditingScenario('b');
      expect(store.activeScenarioId).toBe('a');
      expect(store.editingScenarioId).toBe('b');
    });
  });

  describe('crossoverPeriod', () => {
    it('is non-null for the demo loan (principal < interest in month 1)', () => {
      const store = useLoanStore();
      expect(store.crossoverPeriod).not.toBeNull();
      expect(store.crossoverPeriod!).toBeGreaterThan(1);
    });
  });

  describe('loadDemo', () => {
    it('resets the store back to a fresh demo after edits', () => {
      const store = useLoanStore();
      store.upsertPayment({ date: '3000-01-01', amount: 1 });
      expect(store.activeLoan.payments!.some((p) => p.date === '3000-01-01')).toBe(true);
      store.loadDemo();
      expect(store.activeLoan.payments!.some((p) => p.date === '3000-01-01')).toBe(false);
      expect(store.source.kind).toBe('demo');
    });
  });
});
