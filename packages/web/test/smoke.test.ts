import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import App from '../src/App.vue';

describe('App', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the demo ledger with charts and table', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Demo residence');
    expect(wrapper.text()).toContain('EQUITY');
    expect(wrapper.text()).toContain('Balance over time');
    expect(wrapper.text()).toContain('Payment composition');
    expect(wrapper.text()).toContain('Amortization');
    expect(wrapper.text()).toContain('Scenarios');
    expect(wrapper.text()).toContain('Edit loan');
  });
});
