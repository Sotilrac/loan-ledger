import type { LoanSource } from '@loan-ledger/core';
import { ocs, OcsError } from '../api/ocs.js';
import { PERMISSION_UPDATE } from './ocsLoanRegistry.js';

/**
 * Per-loan source backed by the OCS API. One instance is bound to a single
 * Nextcloud `fileid`; `read()` fetches the raw YAML and stashes the mtime
 * so that the next `write()` can use it as an `If-Match` precondition. If
 * a collaborator updated the file since `read()`, the server replies 412
 * and `write()` rethrows as a `LoanWriteConflictError` so the UI can show
 * a "file changed" banner instead of silently clobbering.
 */
export class OcsLoanSource implements LoanSource {
  readonly kind = 'ocs';
  readonly name: string;
  readonly canWrite: boolean;
  readonly fileId: number;

  private mtime: number;
  private cachedYaml: string | null;

  constructor(entry: {
    fileid: number;
    path: string;
    mtime: number;
    permissions: number;
    content_yaml?: string;
  }) {
    this.fileId = entry.fileid;
    this.name = entry.path.split('/').pop() ?? entry.path;
    this.canWrite = (entry.permissions & PERMISSION_UPDATE) === PERMISSION_UPDATE;
    this.mtime = entry.mtime;
    this.cachedYaml = entry.content_yaml ?? null;
  }

  async read(): Promise<string> {
    if (this.cachedYaml !== null) {
      const cached = this.cachedYaml;
      this.cachedYaml = null;
      return cached;
    }
    const data = await ocs.get<{ content_yaml: string; mtime: number }>(
      `/loans/${this.fileId}/raw`,
    );
    this.mtime = data.mtime;
    return data.content_yaml;
  }

  async write(yaml: string): Promise<void> {
    try {
      const data = await ocs.put<{ mtime: number }>(
        `/loans/${this.fileId}/raw`,
        { content_yaml: yaml },
        { 'If-Match': String(this.mtime) },
      );
      this.mtime = data.mtime;
    } catch (err) {
      if (err instanceof OcsError && err.status === 412) {
        throw new LoanWriteConflictError(err.message);
      }
      throw err;
    }
  }
}

export class LoanWriteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LoanWriteConflictError';
  }
}
