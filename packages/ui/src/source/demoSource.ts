import { buildDemoLoan, serializeLoanYaml, type LoanSource } from '@loan-ledger/core';

/**
 * Read-only source backed by the in-memory demo loan. `write()` is a no-op;
 * the UI wires the "Save" (download) action separately for this case.
 */
export class DemoSource implements LoanSource {
  readonly kind = 'demo';
  readonly name = 'Demo loan';
  readonly canWrite = false;

  read(): Promise<string> {
    return Promise.resolve(serializeLoanYaml(buildDemoLoan()));
  }

  write(): Promise<void> {
    return Promise.resolve();
  }
}
