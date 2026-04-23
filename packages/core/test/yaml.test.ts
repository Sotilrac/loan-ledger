import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLoanYaml, serializeLoanYaml } from '../src/io/yaml.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixture = (p: string): string => resolve(here, 'fixtures', p);

async function readFixture(p: string): Promise<string> {
  return readFile(fixture(p), 'utf-8');
}

describe('parseLoanYaml', () => {
  it('parses a valid .loan.yaml with dates kept as strings', async () => {
    const yaml = await readFixture('loan-files/primary-residence.loan.yaml');
    const result = parseLoanYaml(yaml);
    if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
    expect(result.value.property.name).toBe('Primary residence');
    expect(result.value.property.purchase_date).toBe('2020-06-15');
    expect(typeof result.value.property.purchase_date).toBe('string');
    expect(result.value.loan.rate_schedule).toHaveLength(1);
    expect(result.value.payments).toHaveLength(3);
    expect(result.value.scenarios?.[0]?.mutations[0]?.type).toBe('recurring_extra_principal');
  });

  it('reports a schema violation for a missing required field', async () => {
    const yaml = await readFixture('loan-files/invalid-missing-loan.loan.yaml');
    const result = parseLoanYaml(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes('loan'))).toBe(true);
  });

  it('reports a YAML syntax error with a line reference', () => {
    const bad = 'property:\n  name: "unterminated';
    const result = parseLoanYaml(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.keyword).toBe('yaml');
    expect(result.errors[0]?.message).toMatch(/line/);
  });
});

describe('serializeLoanYaml', () => {
  it('round-trips a parsed file back to YAML that re-parses identically', async () => {
    const yaml = await readFixture('loan-files/primary-residence.loan.yaml');
    const first = parseLoanYaml(yaml);
    if (!first.ok) throw new Error('fixture should parse');
    const serialised = serializeLoanYaml(first.value);
    const second = parseLoanYaml(serialised);
    if (!second.ok) throw new Error(JSON.stringify(second.errors, null, 2));
    expect(second.value).toEqual(first.value);
  });
});
