export const CORE_VERSION = '0.0.0';

export * from './model/types.js';
export * from './engine/types.js';

export { validateLoan, validateMappings } from './io/validate.js';
export {
  parseLoanYaml,
  parseMappingsYaml,
  serializeLoanYaml,
  serializeMappingsYaml,
} from './io/yaml.js';
export { ingestCsv, type IngestOptions } from './io/csv.js';

export { computeLoan } from './engine/loanEngine.js';
export { buildDemoLoan, DEMO_LOAN } from './demo.js';

export {
  addMonths,
  compareDates,
  isOnOrBefore,
  parseISODate,
  toISODate,
  todayISO,
} from './util/date.js';
