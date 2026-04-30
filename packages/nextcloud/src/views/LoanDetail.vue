<script setup lang="ts">
import { parseLoanYaml } from '@loan-ledger/core';
import { computed, onMounted, ref, watch } from 'vue';
import { OcsLoanSource } from '../source/ocsLoanSource.js';
import { useLoansStore } from '../stores/loans.js';

const props = defineProps<{ fileId: number }>();

const loansStore = useLoansStore();
const yamlText = ref<string>('');
const loadError = ref<string | null>(null);
const source = ref<OcsLoanSource | null>(null);

const parsed = computed(() => (yamlText.value ? parseLoanYaml(yamlText.value) : null));

async function load(): Promise<void> {
  loadError.value = null;
  yamlText.value = '';

  if (loansStore.entries.length === 0) {
    await loansStore.refresh();
  }

  const entry = loansStore.getById(props.fileId);
  if (!entry) {
    loadError.value = `No loan with id ${props.fileId} in the configured folder.`;
    return;
  }

  source.value = new OcsLoanSource(entry);
  try {
    yamlText.value = await source.value.read();
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err);
  }
}

onMounted(load);
watch(() => props.fileId, load);
</script>

<template>
  <section>
    <p>
      <RouterLink :to="{ name: 'list' }">← Back to loans</RouterLink>
    </p>

    <div v-if="loadError" class="ll-error">{{ loadError }}</div>

    <template v-else-if="yamlText">
      <h2 v-if="parsed?.ok" style="margin-top: 0">
        {{ parsed.value.property.name }}
      </h2>
      <p v-else-if="parsed && !parsed.ok" class="ll-error">
        YAML failed to parse: {{ parsed.errors[0]?.message }}
      </p>

      <p style="font-size: 0.75rem; color: var(--color-text-maxcontrast, #888)">
        Rich UI ports in M4. For now: raw YAML.
      </p>

      <pre class="ll-detail__yaml">{{ yamlText }}</pre>
    </template>

    <div v-else class="ll-empty">Loading…</div>
  </section>
</template>
