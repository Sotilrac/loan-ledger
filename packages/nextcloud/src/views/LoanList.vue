<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useLoansStore } from '../stores/loans.js';
import { useSettingsStore } from '../stores/settings.js';

const loansStore = useLoansStore();
const settings = useSettingsStore();

const folder = computed(() => settings.folder);

onMounted(() => {
  void loansStore.refresh();
});

function formatMtime(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString();
}

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}
</script>

<template>
  <section class="ll-route--scroll">
    <p class="ll-loanlist__caption">
      Loans found in <code>{{ folder }}</code>
    </p>

    <div v-if="loansStore.loading" class="ll-empty">Loading…</div>

    <div v-else-if="loansStore.error?.kind === 'folder_missing'" class="ll-error">
      <p>
        The folder <code>{{ folder }}</code> doesn't exist in your Nextcloud.
      </p>
      <p>Create it (or pick a different one) in Settings, then refresh.</p>
    </div>

    <div v-else-if="loansStore.error" class="ll-error">
      Couldn't load loans: {{ loansStore.error.message }}
    </div>

    <div v-else-if="loansStore.entries.length === 0" class="ll-empty">
      No <code>.loan.yaml</code> files found in <code>{{ folder }}</code> yet.
    </div>

    <div v-else class="ll-loanlist">
      <RouterLink
        v-for="entry in loansStore.entries"
        :key="entry.fileid"
        :to="{ name: 'detail', params: { fileId: entry.fileid } }"
        class="ll-loanlist__item"
      >
        <span class="ll-loanlist__path">{{ basename(entry.path) }}</span>
        <span class="ll-loanlist__meta">{{ formatMtime(entry.mtime) }}</span>
      </RouterLink>
    </div>
  </section>
</template>
