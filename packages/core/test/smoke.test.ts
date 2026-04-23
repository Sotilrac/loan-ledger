import { describe, expect, it } from 'vitest';
import { CORE_VERSION } from '../src/index.js';

describe('@loan-ledger/core', () => {
  it('exports a version constant', () => {
    expect(CORE_VERSION).toBe('0.0.0');
  });
});
