import type { LoanSource } from '@loan-ledger/core';

/**
 * Source for the `<input type="file">` fallback path used when the browser
 * doesn't expose a writable File System Access handle. The app holds the
 * file's text in memory; `write()` is a no-op because there is no writable
 * target. The UI still offers a download-based "Save" action separately.
 */
export class FallbackSource implements LoanSource {
  readonly kind = 'fallback';
  readonly canWrite = false;
  readonly name: string;

  private initialText: string;

  constructor(fileName: string, text: string) {
    this.name = fileName;
    this.initialText = text;
  }

  read(): Promise<string> {
    return Promise.resolve(this.initialText);
  }

  write(): Promise<void> {
    return Promise.resolve();
  }
}
