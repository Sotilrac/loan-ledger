<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="ll-shell">
    <header class="ll-shell__bar">
      <h1 class="ll-shell__title">Loan Ledger</h1>
      <nav class="ll-shell__nav">
        <RouterLink :to="{ name: 'list' }" exact-active-class="is-active">Loans</RouterLink>
        <RouterLink :to="{ name: 'settings' }" exact-active-class="is-active">Settings</RouterLink>
      </nav>
    </header>
    <main class="ll-shell__main">
      <RouterView />
    </main>
  </div>
</template>
