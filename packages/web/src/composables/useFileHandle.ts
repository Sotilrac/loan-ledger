import { del, get, set } from 'idb-keyval';

const HANDLE_KEY = 'll:last-file-handle';

type WriteFileHandle = FileSystemFileHandle & {
  createWritable: () => Promise<FileSystemWritableFileStream>;
};

type PermissionState = 'granted' | 'denied' | 'prompt';

export interface FsaFileHandle extends WriteFileHandle {
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (opts?: {
      types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      multiple?: boolean;
      excludeAcceptAllOption?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  }
}

export function fsaSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
}

export interface OpenedFile {
  name: string;
  text: string;
  handle: FsaFileHandle | null;
}

/** Prompt the user to pick a `.loan.yaml` via the FSA picker. */
export async function pickLoanFile(): Promise<OpenedFile | null> {
  if (!fsaSupported() || !window.showOpenFilePicker) return null;

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Loan Ledger file',
          accept: { 'application/x-yaml': ['.yaml', '.yml'] },
        },
      ],
      multiple: false,
      excludeAcceptAllOption: false,
    });
    if (!handle) return null;
    const fsaHandle = handle as FsaFileHandle;
    const file = await fsaHandle.getFile();
    const text = await file.text();
    await set(HANDLE_KEY, fsaHandle);
    return { name: fsaHandle.name, text, handle: fsaHandle };
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null;
    throw err;
  }
}

/**
 * Fallback for browsers without FSA: read a `File` from a file input.
 * Edits will have to be downloaded manually because there's no writable handle.
 */
export async function readFile(file: File): Promise<OpenedFile> {
  const text = await file.text();
  return { name: file.name, text, handle: null };
}

export async function restoreHandle(): Promise<FsaFileHandle | null> {
  const saved = (await get(HANDLE_KEY)) as FsaFileHandle | undefined;
  if (!saved) return null;
  if (!saved.queryPermission) return saved;
  const state = await saved.queryPermission({ mode: 'readwrite' });
  if (state === 'granted') return saved;
  return saved;
}

/**
 * Request readwrite permission on a previously-saved handle.
 * Must be called from a user gesture handler, per the spec.
 */
export async function requestWritePermission(handle: FsaFileHandle): Promise<boolean> {
  if (!handle.requestPermission) return true;
  const state = await handle.requestPermission({ mode: 'readwrite' });
  return state === 'granted';
}

export async function writeToHandle(handle: FsaFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/** Fallback save path: trigger a download of the text as a file. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/x-yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function forgetHandle(): Promise<void> {
  await del(HANDLE_KEY);
}
