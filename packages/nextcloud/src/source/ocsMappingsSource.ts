import type { MappingsSource } from '@loan-ledger/core';
import { ocs } from '../api/ocs.js';

/**
 * Mappings source backed by `<ledgers>/.mappings.yaml`. Persisting to a
 * regular file (instead of `localStorage`) is what lets a household share
 * column-mapping presets along with the loan files themselves.
 */
export class OcsMappingsSource implements MappingsSource {
  readonly kind = 'ocs';
  readonly name = '.mappings.yaml';
  readonly canWrite = true;

  async read(): Promise<string> {
    const data = await ocs.get<{ content_yaml: string }>('/mappings/raw');
    return data.content_yaml;
  }

  async write(yaml: string): Promise<void> {
    await ocs.put('/mappings/raw', { content_yaml: yaml });
  }
}
