/**
 * Tiny wrapper around `fetch` that talks to the Loan Ledger OCS API.
 *
 * Nextcloud requires the `OCS-APIRequest: true` header on every OCS call.
 * For state-changing methods we also send the requesttoken (CSRF) that
 * Nextcloud injects on every page render via `OC.requestToken`.
 *
 * Responses follow the OCS envelope:
 *
 *   { ocs: { meta: { status, statuscode, message }, data: <payload> } }
 *
 * `request<T>()` unwraps `data` and surfaces the OCS status code on errors
 * so callers can distinguish 404 (folder missing / not found) from 412
 * (write-conflict) without parsing strings.
 */

const APP_ID = 'loanledger';

export class OcsError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OcsError';
  }
}

interface OcsEnvelope<T> {
  ocs: {
    meta: { status: string; statuscode: number; message?: string };
    data: T;
  };
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

function getRequestToken(): string {
  const w = window as unknown as { OC?: { requestToken?: string } };
  return w.OC?.requestToken ?? '';
}

function getBaseUrl(): string {
  const w = window as unknown as { OC?: { getRootPath?: () => string } };
  // OCS endpoints live at `<webroot>/ocs/v2.php/...` and must NOT be routed
  // through the front controller. `OC.generateUrl` injects `/index.php` when
  // pretty URLs are off (`OC.config.modRewriteWorking === false`), producing
  // `/index.php/ocs/v2.php/...`, which 404s. Build from the webroot instead so
  // it works regardless of the instance's rewrite config and still honors
  // subpath installs (e.g. `/nextcloud`). `getRootPath()` returns the webroot
  // with no trailing slash (`''` for a root install).
  const root = w.OC?.getRootPath?.() ?? '';
  return `${root}/ocs/v2.php/apps/${APP_ID}/api/v1`;
}

async function request<T>(
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'OCS-APIRequest': 'true',
    Accept: 'application/json',
    ...extraHeaders,
  };
  if (method !== 'GET') {
    const token = getRequestToken();
    if (token) headers['requesttoken'] = token;
  }

  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const url = `${getBaseUrl()}${path}?format=json`;
  const response = await fetch(url, init);
  const json = (await response.json().catch(() => ({}))) as Partial<OcsEnvelope<T>>;
  const data = json.ocs?.data;

  if (!response.ok) {
    const err = (data ?? {}) as ErrorPayload;
    throw new OcsError(
      response.status,
      err.error ?? `http_${response.status}`,
      err.message ?? response.statusText,
    );
  }
  if (data === undefined) {
    throw new OcsError(response.status, 'invalid_envelope', 'Missing OCS data field');
  }
  return data;
}

export const ocs = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  put: <T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T> =>
    request<T>('PUT', path, body, headers),
  post: <T>(path: string, body: unknown): Promise<T> => request<T>('POST', path, body),
};
