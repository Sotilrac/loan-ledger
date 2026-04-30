import { ocs } from '../api/ocs.js';

/**
 * One row of `GET /api/v1/loans`. Nextcloud `permissions` is a bitmask
 * (`Constants::PERMISSION_*`) — the UI only cares whether write is set
 * (bit 2 = `PERMISSION_UPDATE`).
 */
export interface OcsLoanListEntry {
  fileid: number;
  path: string;
  content_yaml: string;
  mtime: number;
  permissions: number;
}

interface ListResponse {
  loans: OcsLoanListEntry[];
}

/**
 * Reads the list of loans in the user's configured ledgers folder. The
 * server returns full YAML content for each entry so the dashboard can
 * render summary cards without an N+1 round trip.
 */
export class OcsLoanRegistry {
  async list(): Promise<OcsLoanListEntry[]> {
    const data = await ocs.get<ListResponse>('/loans');
    return data.loans;
  }
}

export const PERMISSION_UPDATE = 2;
