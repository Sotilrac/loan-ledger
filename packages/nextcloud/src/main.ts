import { setMappingsSource } from '@loan-ledger/ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router.js';
import { OcsMappingsSource } from './source/ocsMappingsSource.js';
import '@loan-ledger/ui/style/tokens.css';
import './style/app.css';

// Mappings travel with the loan files via `<ledgers>/.mappings.yaml` so
// they're visible to anyone the folder is shared with.
setMappingsSource(new OcsMappingsSource());

createApp(App).use(createPinia()).use(router).mount('#loanledger-app');
