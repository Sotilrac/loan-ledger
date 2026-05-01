import { ocs } from '../api/ocs.js';

interface Settings {
  folders: string[];
}

interface FolderCreated {
  path: string;
  fileid: number;
}

export const settingsApi = {
  get: (): Promise<Settings> => ocs.get<Settings>('/settings'),
  set: (folders: string[]): Promise<Settings> => ocs.put<Settings>('/settings', { folders }),
  createFolder: (path: string): Promise<FolderCreated> =>
    ocs.post<FolderCreated>('/folders', { path }),
};
