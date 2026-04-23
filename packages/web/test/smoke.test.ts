import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../src/App.vue';

describe('App', () => {
  it('renders the demo ledger with charts', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Demo residence');
    expect(wrapper.text()).toContain('EQUITY');
    expect(wrapper.text()).toContain('Balance over time');
    expect(wrapper.text()).toContain('Payment composition');
    expect(wrapper.text()).toContain('Scenarios');
  });
});
