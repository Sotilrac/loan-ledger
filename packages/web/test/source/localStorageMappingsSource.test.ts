import { parseMappingsYaml } from '@loan-ledger/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageMappingsSource } from '../../src/source/localStorageMappingsSource.js';

const STORAGE_KEY = '@loan-ledger/web:mappings';

describe('LocalStorageMappingsSource', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty string when nothing is stored', async () => {
    const src = new LocalStorageMappingsSource();
    expect(await src.read()).toBe('');
  });

  it('writes YAML and reads it back unchanged', async () => {
    const src = new LocalStorageMappingsSource();
    const yaml = [
      'schema_version: 1',
      'mappings:',
      '  - name: Chase mortgage',
      '    date_format: YYYY-MM-DD',
      '    columns:',
      '      date: Posted Date',
      '      amount: Amount',
      '',
    ].join('\n');
    await src.write(yaml);
    expect(await src.read()).toBe(yaml);
  });

  it('migrates a legacy JSON-array value to a MappingsFile YAML on first read', async () => {
    const legacy = JSON.stringify([
      {
        name: 'Old bank',
        date_format: 'MM/DD/YYYY',
        columns: { date: 'Date', amount: 'Amount' },
      },
    ]);
    localStorage.setItem(STORAGE_KEY, legacy);

    const src = new LocalStorageMappingsSource();
    const yaml = await src.read();

    const parsed = parseMappingsYaml(yaml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.schema_version).toBe(1);
    expect(parsed.value.mappings).toHaveLength(1);
    expect(parsed.value.mappings[0]?.name).toBe('Old bank');

    // Migration should have rewritten storage in place so the next read is
    // a no-op.
    const stored = localStorage.getItem(STORAGE_KEY) ?? '';
    expect(stored).toBe(yaml);
    expect(stored.startsWith('[')).toBe(false);
  });

  it('reports canWrite=true and a stable kind', () => {
    const src = new LocalStorageMappingsSource();
    expect(src.kind).toBe('local-storage');
    expect(src.canWrite).toBe(true);
  });
});
