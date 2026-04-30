import { setMappingsSource } from '@loan-ledger/ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import App from './App.vue';
import { LocalStorageMappingsSource } from './source/localStorageMappingsSource.js';
import './style/tokens.css';

setMappingsSource(new LocalStorageMappingsSource());

const app = createApp(App);
app.use(createPinia());
app.mount('#app');
