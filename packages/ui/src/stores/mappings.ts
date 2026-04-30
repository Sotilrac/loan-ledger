import type { CsvMapping, MappingsFile, MappingsSource } from '@loan-ledger/core';
import { parseMappingsYaml, serializeMappingsYaml } from '@loan-ledger/core';
import { defineStore } from 'pinia';
import { nextTick, ref, watch } from 'vue';

/**
 * Default in-memory source used if neither target wires up a real one. The
 * web build immediately replaces it with a `LocalStorageMappingsSource`;
 * the Nextcloud build replaces it with an `OcsMappingsSource`. Tests use
 * fakes via `setMappingsSource()`.
 */
class NoopMappingsSource implements MappingsSource {
  readonly kind = 'noop';
  readonly name = 'In-memory';
  readonly canWrite = true;
  private yaml = '';
  read(): Promise<string> {
    return Promise.resolve(this.yaml);
  }

  write(yaml: string): Promise<void> {
    this.yaml = yaml;
    return Promise.resolve();
  }
}

let activeSource: MappingsSource = new NoopMappingsSource();

/**
 * Swap the mappings source. Each target calls this at startup; tests can
 * use it to inject a fake. Has no effect on stores that have already
 * loaded.
 */
export function setMappingsSource(source: MappingsSource): void {
  activeSource = source;
}

function loadFromYaml(yaml: string): CsvMapping[] {
  if (!yaml.trim()) return [];
  const result = parseMappingsYaml(yaml);
  if (!result.ok) return [];
  return result.value.mappings;
}

export const useMappingsStore = defineStore('mappings', () => {
  const source = ref<MappingsSource>(activeSource);
  const mappings = ref<CsvMapping[]>([]);
  const loaded = ref<boolean>(false);

  async function hydrate(): Promise<void> {
    const yaml = await source.value.read();
    mappings.value = loadFromYaml(yaml);
    // Let the deep watcher fire on the hydration assignment with `loaded`
    // still false, so it bails before the gate flips. Without this, we'd
    // immediately write back the YAML we just read.
    await nextTick();
    loaded.value = true;
  }

  // Kick off the read; tests that need it deterministically can `await
  // mappingsStore.hydrated`.
  const hydrated = hydrate();

  watch(
    mappings,
    (next) => {
      if (!loaded.value) return;
      const file: MappingsFile = { schema_version: 1, mappings: next };
      void source.value.write(serializeMappingsYaml(file));
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

  return { mappings, source, loaded, hydrated, upsert, remove, getByName };
});
