import type { CsvMapping, MappingsFile, MappingsSource } from '@loan-ledger/core';
import { serializeMappingsYaml } from '@loan-ledger/core';

const STORAGE_KEY = '@loan-ledger/web:mappings';

/**
 * Mappings source backed by `localStorage`. Web stays on per-browser storage
 * by design (no account, no sync); the Nextcloud target uses a shared
 * `.mappings.yaml` instead.
 *
 * The stored value is YAML text, identical in shape to what the Nextcloud
 * adapter reads and writes, so the store never has to branch on source kind.
 * Older installs that wrote a raw JSON `CsvMapping[]` are migrated to YAML
 * on first read.
 */
export class LocalStorageMappingsSource implements MappingsSource {
  readonly kind = 'local-storage';
  readonly name = 'Browser storage';
  readonly canWrite = true;

  read(): Promise<string> {
    if (typeof localStorage === 'undefined') return Promise.resolve('');
    const raw = readRaw();
    if (raw === null) return Promise.resolve('');
    const migrated = migrateLegacyIfNeeded(raw);
    return Promise.resolve(migrated);
  }

  write(yaml: string): Promise<void> {
    if (typeof localStorage === 'undefined') return Promise.resolve();
    try {
      localStorage.setItem(STORAGE_KEY, yaml);
    } catch {
      /* quota or private mode — swallow, matching prior behavior */
    }
    return Promise.resolve();
  }
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function migrateLegacyIfNeeded(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith('[')) return raw;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return raw;
  }
  if (!Array.isArray(parsed)) return raw;
  const file: MappingsFile = { schema_version: 1, mappings: parsed as CsvMapping[] };
  const yaml = serializeMappingsYaml(file);
  try {
    localStorage.setItem(STORAGE_KEY, yaml);
  } catch {
    /* keep the in-memory migration even if persistence fails */
  }
  return yaml;
}
