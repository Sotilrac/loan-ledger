import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../src/App.vue';

describe('App', () => {
  it('renders the demo ledger', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Demo residence');
    expect(wrapper.text()).toContain('Equity');
    expect(wrapper.text()).toContain('Current balance');
  });
});
