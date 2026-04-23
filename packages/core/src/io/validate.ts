import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import loanSchema from '../schemas/loan.schema.json' with { type: 'json' };
import mappingsSchema from '../schemas/mappings.schema.json' with { type: 'json' };
import type { LoanFile, MappingsFile, ValidationError, ValidationResult } from '../model/types.js';

const ajv = new Ajv({ allErrors: true, strict: true, strictSchema: 'log' });
addFormats(ajv);

const validateLoanFn: ValidateFunction<LoanFile> = ajv.compile<LoanFile>(loanSchema);
const validateMappingsFn: ValidateFunction<MappingsFile> =
  ajv.compile<MappingsFile>(mappingsSchema);

function formatErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return [];
  return errors.map((e) => ({
    path: e.instancePath || '/',
    message: e.message ?? 'validation error',
    keyword: e.keyword,
  }));
}

export function validateLoan(data: unknown): ValidationResult<LoanFile> {
  if (validateLoanFn(data)) {
    return { ok: true, value: data };
  }
  return { ok: false, errors: formatErrors(validateLoanFn.errors) };
}

export function validateMappings(data: unknown): ValidationResult<MappingsFile> {
  if (validateMappingsFn(data)) {
    return { ok: true, value: data };
  }
  return { ok: false, errors: formatErrors(validateMappingsFn.errors) };
}
