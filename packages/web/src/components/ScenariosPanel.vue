<script setup lang="ts">
import { PhPencilSimple, PhPlus, PhTrash, PhX } from '@phosphor-icons/vue';
import { computed } from 'vue';
import { useLoanStore } from '../stores/loan.js';
import ScenarioEditor from './ScenarioEditor.vue';

const store = useLoanStore();

const currency = computed(() => store.activeLoan.property.currency);

function fmtInterestDelta(n: number): string {
  if (n === 0) return 'no interest change';
  const abs = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.value,
    maximumFractionDigits: 0,
  }).format(Math.abs(n));
  return n > 0 ? `−${abs} interest` : `+${abs} interest`;
}

function fmtMonthsDelta(n: number): string {
  if (n === 0) return 'same payoff date';
  const abs = Math.abs(n);
  const unit = abs === 1 ? 'month' : 'months';
  return n > 0 ? `${abs} ${unit} earlier` : `${abs} ${unit} later`;
}

function addScenario() {
  const id = `scenario-${Date.now().toString(36)}`;
  store.updateLoan((l) => {
    const list = (l.scenarios ??= []);
    list.push({ id, name: `Scenario ${list.length + 1}`, mutations: [] });
  });
  store.activeScenarioId = id;
  store.editingScenarioId = id;
}

function removeScenario(id: string) {
  store.updateLoan((l) => {
    if (!l.scenarios) return;
    l.scenarios = l.scenarios.filter((s) => s.id !== id);
  });
  if (store.activeScenarioId === id) store.activeScenarioId = null;
  if (store.editingScenarioId === id) store.editingScenarioId = null;
}
</script>

<template>
  <aside class="scenarios">
    <div class="scenarios-header">
      <p class="label">Scenarios</p>
      <button
        type="button"
        class="icon-btn"
        title="Add scenario"
        aria-label="Add scenario"
        @click="addScenario"
      >
        <PhPlus :size="16" weight="regular" />
      </button>
    </div>

    <ul v-if="(store.activeLoan.scenarios ?? []).length">
      <li
        v-for="scenario in store.activeLoan.scenarios ?? []"
        :key="scenario.id"
        :class="{
          active: store.activeScenarioId === scenario.id,
          editing: store.editingScenarioId === scenario.id,
        }"
      >
        <div
          class="scenario-card"
          :aria-pressed="store.activeScenarioId === scenario.id"
          role="button"
          :tabindex="0"
          @click="store.toggleScenario(scenario.id)"
          @keyup.enter="store.toggleScenario(scenario.id)"
        >
          <div class="scenario-top">
            <p class="scenario-name">{{ scenario.name }}</p>
            <div
              v-if="
                store.activeScenarioId === scenario.id || store.editingScenarioId === scenario.id
              "
              class="actions"
            >
              <button
                type="button"
                class="icon-btn"
                :title="store.editingScenarioId === scenario.id ? 'Close editor' : 'Edit scenario'"
                :aria-label="
                  store.editingScenarioId === scenario.id ? 'Close editor' : 'Edit scenario'
                "
                @click.stop="store.toggleEditingScenario(scenario.id)"
              >
                <PhX v-if="store.editingScenarioId === scenario.id" :size="15" weight="regular" />
                <PhPencilSimple v-else :size="15" weight="regular" />
              </button>
              <button
                type="button"
                class="icon-btn danger"
                title="Delete scenario"
                aria-label="Delete scenario"
                @click.stop="removeScenario(scenario.id)"
              >
                <PhTrash :size="15" weight="regular" />
              </button>
            </div>
          </div>
          <p v-if="scenario.description" class="scenario-desc">{{ scenario.description }}</p>
          <ul v-if="store.scenarios.get(scenario.id)" class="delta">
            <li
              :class="{
                positive: store.scenarios.get(scenario.id)!.delta.interest_saved > 0,
                negative: store.scenarios.get(scenario.id)!.delta.interest_saved < 0,
              }"
            >
              {{ fmtInterestDelta(store.scenarios.get(scenario.id)!.delta.interest_saved) }}
            </li>
            <li
              :class="{
                positive: store.scenarios.get(scenario.id)!.delta.months_sooner > 0,
                negative: store.scenarios.get(scenario.id)!.delta.months_sooner < 0,
              }"
            >
              {{ fmtMonthsDelta(store.scenarios.get(scenario.id)!.delta.months_sooner) }}
            </li>
          </ul>

          <ScenarioEditor
            v-if="store.editingScenarioId === scenario.id"
            :scenario-id="scenario.id"
          />
        </div>
      </li>
    </ul>
    <p v-else class="readout empty"><em>No scenarios yet. Click + to add one.</em></p>
  </aside>
</template>

<style scoped src="./ScenariosPanel.css"></style>
