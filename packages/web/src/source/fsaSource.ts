import type { LoanSource } from '@loan-ledger/core';
import type { FsaFileHandle } from '../composables/useFileHandle.js';
import { requestWritePermission, writeToHandle } from '../composables/useFileHandle.js';

/**
 * File System Access–backed source. `read()` fetches the current file
 * contents; `write()` requests readwrite permission then writes in place.
 *
 * Construct with the handle returned from `pickLoanFile()` (and the text you
 * already read from it, so the initial `read()` doesn't hit the disk twice).
 */
export class FsaSource implements LoanSource {
  readonly kind = 'fsa';
  readonly canWrite = true;
  readonly name: string;
  readonly handle: FsaFileHandle;

  private initialText: string | null;

  constructor(handle: FsaFileHandle, initialText: string) {
    this.handle = handle;
    this.name = handle.name;
    this.initialText = initialText;
  }

  async read(): Promise<string> {
    if (this.initialText !== null) {
      const cached = this.initialText;
      this.initialText = null;
      return cached;
    }
    const file = await this.handle.getFile();
    return file.text();
  }

  async write(yaml: string): Promise<void> {
    const granted = await requestWritePermission(this.handle);
    if (!granted) throw new Error('Write permission denied');
    await writeToHandle(this.handle, yaml);
  }
}
