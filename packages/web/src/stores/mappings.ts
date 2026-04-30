import type { CsvMapping, MappingsFile, MappingsSource } from '@loan-ledger/core';
import { parseMappingsYaml, serializeMappingsYaml } from '@loan-ledger/core';
import { defineStore } from 'pinia';
import { nextTick, ref, watch } from 'vue';
import { LocalStorageMappingsSource } from '../source/localStorageMappingsSource.js';

let activeSource: MappingsSource = new LocalStorageMappingsSource();

/**
 * Swap the mappings source. The Nextcloud build calls this at startup to
 * point the store at an OCS-backed `.mappings.yaml`. Tests can use it to
 * inject a fake. Has no effect on stores that have already loaded.
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
