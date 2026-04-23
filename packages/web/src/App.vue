<script setup lang="ts">
import { CORE_VERSION } from '@loan-ledger/core';
</script>

<template>
  <main>
    <h1>Loan Ledger</h1>
    <p>Core version: {{ CORE_VERSION }}</p>
  </main>
</template>

<style scoped>
main {
  padding: 2rem;
  font-family: system-ui, sans-serif;
}
</style>
