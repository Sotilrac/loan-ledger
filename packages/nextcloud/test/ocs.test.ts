import { afterEach, describe, expect, it, vi } from 'vitest';
import { ocs } from '../src/api/ocs.js';

/**
 * Regression guard for the OCS base URL. OCS endpoints must resolve to
 * `<webroot>/ocs/v2.php/...` and must never be routed through the front
 * controller: on instances with pretty URLs off (`modRewriteWorking ===
 * false`), an `OC.generateUrl`-built path gains an `/index.php` prefix
 * (`/index.php/ocs/v2.php/...`) which 404s. See `src/api/ocs.ts`.
 */
function mockOcsOk() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ ocs: { meta: { status: 'ok', statuscode: 200 }, data: {} } }),
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  delete (globalThis as Record<string, unknown>).window;
});

describe('ocs base url', () => {
  it('targets /ocs/v2.php directly at the webroot root install (no index.php)', async () => {
    const fetchMock = mockOcsOk();
    (globalThis as Record<string, unknown>).window = { OC: { getRootPath: () => '' } };
    vi.stubGlobal('fetch', fetchMock);

    await ocs.get('/loans');

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe('/ocs/v2.php/apps/loanledger/api/v1/loans?format=json');
    expect(url).not.toContain('index.php');
  });

  it('honors a subpath install webroot', async () => {
    const fetchMock = mockOcsOk();
    (globalThis as Record<string, unknown>).window = { OC: { getRootPath: () => '/nextcloud' } };
    vi.stubGlobal('fetch', fetchMock);

    await ocs.get('/loans');

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe('/nextcloud/ocs/v2.php/apps/loanledger/api/v1/loans?format=json');
    expect(url).not.toContain('index.php');
  });

  it('falls back to a root-relative OCS path when OC is unavailable', async () => {
    const fetchMock = mockOcsOk();
    (globalThis as Record<string, unknown>).window = {};
    vi.stubGlobal('fetch', fetchMock);

    await ocs.get('/loans');

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toBe('/ocs/v2.php/apps/loanledger/api/v1/loans?format=json');
  });
});
