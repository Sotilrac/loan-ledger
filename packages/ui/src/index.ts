// Stores
export { useLoanStore } from './stores/loan.js';
export { setMappingsSource, useMappingsStore } from './stores/mappings.js';

// Source adapters that work in any browser-hosted target
export { DemoSource } from './source/demoSource.js';
export { FallbackSource } from './source/fallbackSource.js';

// Utilities
export { downloadText } from './util/download.js';
export * as format from './format.js';

// Components
export { default as AmortizationTable } from './components/AmortizationTable.vue';
export { default as CsvImportDialog } from './components/CsvImportDialog.vue';
export { default as LoanEditForm } from './components/LoanEditForm.vue';
export { default as PaymentEditorRow } from './components/PaymentEditorRow.vue';
export { default as ScenarioEditor } from './components/ScenarioEditor.vue';
export { default as ScenariosPanel } from './components/ScenariosPanel.vue';

// Charts
export { default as BalanceChart } from './charts/BalanceChart.vue';
export { default as EquityGauge } from './charts/EquityGauge.vue';
export { chartPalette, chartMargin } from './charts/palette.js';
export {
  formatMonthFullYear,
  formatMonthLabel,
  formatMonthOnly,
  formatShortCurrency,
  linearScale,
  niceTicks,
} from './charts/scale.js';
