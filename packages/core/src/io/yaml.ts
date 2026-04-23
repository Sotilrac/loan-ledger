import yaml from 'js-yaml';
import type { LoanFile, MappingsFile, ValidationError, ValidationResult } from '../model/types.js';
import { validateLoan, validateMappings } from './validate.js';

/**
 * Parse a `.loan.yaml` string.
 *
 * Uses js-yaml's CORE schema so unquoted dates like `2020-06-15` stay as
 * strings — we never want JS `Date` objects in the data model.
 */
export function parseLoanYaml(source: string): ValidationResult<LoanFile> {
  let raw: unknown;
  try {
    raw = yaml.load(source, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    return {
      ok: false,
      errors: [parseErrorToValidation(err)],
    };
  }
  return validateLoan(raw);
}

/** Parse a shared `.mappings.yaml` string. */
export function parseMappingsYaml(source: string): ValidationResult<MappingsFile> {
  let raw: unknown;
  try {
    raw = yaml.load(source, { schema: yaml.CORE_SCHEMA });
  } catch (err) {
    return {
      ok: false,
      errors: [parseErrorToValidation(err)],
    };
  }
  return validateMappings(raw);
}

/** Serialize a validated loan file back to YAML. */
export function serializeLoanYaml(loan: LoanFile): string {
  return yaml.dump(loan, {
    schema: yaml.CORE_SCHEMA,
    noRefs: true,
    sortKeys: false,
    lineWidth: 100,
    quotingType: '"',
  });
}

/** Serialize a validated mappings file back to YAML. */
export function serializeMappingsYaml(mappings: MappingsFile): string {
  return yaml.dump(mappings, {
    schema: yaml.CORE_SCHEMA,
    noRefs: true,
    sortKeys: false,
    lineWidth: 100,
    quotingType: '"',
  });
}

function parseErrorToValidation(err: unknown): ValidationError {
  if (err instanceof yaml.YAMLException) {
    const line = err.mark ? ` at line ${err.mark.line + 1}, column ${err.mark.column + 1}` : '';
    return {
      path: '/',
      message: `YAML parse error${line}: ${err.reason}`,
      keyword: 'yaml',
    };
  }
  return {
    path: '/',
    message: err instanceof Error ? err.message : 'unknown YAML parse error',
    keyword: 'yaml',
  };
}
