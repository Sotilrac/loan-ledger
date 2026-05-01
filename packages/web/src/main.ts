import { setMappingsSource } from '@loan-ledger/ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { LocalStorageMappingsSource } from './source/localStorageMappingsSource.js';
import '@loan-ledger/ui/style/tokens.css';
import '@loan-ledger/ui/style/base.css';
import '@loan-ledger/ui/style/typography.css';

setMappingsSource(new LocalStorageMappingsSource());

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
