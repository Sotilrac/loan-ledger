import type { CsvMapping, MappingsSource } from '@loan-ledger/core';
import { parseMappingsYaml, serializeMappingsYaml } from '@loan-ledger/core';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setMappingsSource, useMappingsStore } from '../../src/stores/mappings.js';

class FakeSource implements MappingsSource {
  readonly kind = 'fake';
  readonly name = 'Fake';
  readonly canWrite = true;
  yaml: string;
  reads = 0;
  writes: string[] = [];

  constructor(initial = '') {
    this.yaml = initial;
  }

  read(): Promise<string> {
    this.reads += 1;
    return Promise.resolve(this.yaml);
  }

  write(yaml: string): Promise<void> {
    this.writes.push(yaml);
    this.yaml = yaml;
    return Promise.resolve();
  }
}

const sample: CsvMapping = {
  name: 'Chase mortgage',
  date_format: 'YYYY-MM-DD',
  columns: { date: 'Posted Date', amount: 'Amount' },
};

describe('useMappingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('hydrates from the active source on first access', async () => {
    const yaml = serializeMappingsYaml({ schema_version: 1, mappings: [sample] });
    const fake = new FakeSource(yaml);
    setMappingsSource(fake);

    const store = useMappingsStore();
    await store.hydrated;

    expect(fake.reads).toBe(1);
    expect(store.mappings).toHaveLength(1);
    expect(store.mappings[0]?.name).toBe('Chase mortgage');
    expect(store.loaded).toBe(true);
  });

  it('starts empty when the source returns an empty string', async () => {
    const fake = new FakeSource('');
    setMappingsSource(fake);
    const store = useMappingsStore();
    await store.hydrated;
    expect(store.mappings).toEqual([]);
  });

  it('persists upserts back through the source as a MappingsFile YAML', async () => {
    const fake = new FakeSource('');
    setMappingsSource(fake);
    const store = useMappingsStore();
    await store.hydrated;

    store.upsert(sample);
    await vi.waitUntil(() => fake.writes.length > 0);

    const last = fake.writes.at(-1) ?? '';
    const parsed = parseMappingsYaml(last);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.schema_version).toBe(1);
    expect(parsed.value.mappings).toEqual([sample]);
  });

  it('does not write back during the initial hydration', async () => {
    const yaml = serializeMappingsYaml({ schema_version: 1, mappings: [sample] });
    const fake = new FakeSource(yaml);
    setMappingsSource(fake);

    const store = useMappingsStore();
    await store.hydrated;
    // Allow the watcher one more microtask.
    await Promise.resolve();
    expect(fake.writes).toEqual([]);
  });

  it('remove drops by name and getByName returns the match', async () => {
    const fake = new FakeSource('');
    setMappingsSource(fake);
    const store = useMappingsStore();
    await store.hydrated;

    store.upsert(sample);
    store.upsert({ ...sample, name: 'Other bank' });
    expect(store.getByName('Other bank')).toBeDefined();

    store.remove('Other bank');
    expect(store.getByName('Other bank')).toBeUndefined();
    expect(store.mappings).toHaveLength(1);
  });
});
