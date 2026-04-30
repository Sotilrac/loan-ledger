import { ocs } from '../api/ocs.js';

interface Settings {
  folder: string;
}

export const settingsApi = {
  get: (): Promise<Settings> => ocs.get<Settings>('/settings'),
  set: (folder: string): Promise<Settings> => ocs.put<Settings>('/settings', { folder }),
};
