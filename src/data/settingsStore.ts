import { create } from 'zustand';
import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS } from '../types';
import { readJSON, writeJSON, StorageKeys } from './storage';

interface SettingsState extends AppSettings {
  loaded: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  async hydrate() {
    const stored = await readJSON<Partial<AppSettings>>(StorageKeys.SETTINGS, {});
    set({ ...DEFAULT_SETTINGS, ...stored, loaded: true });
  },

  async update(patch) {
    const next = { ...get(), ...patch };
    const { loaded, hydrate, update, ...persistable } = next;
    void loaded; void hydrate; void update;
    await writeJSON(StorageKeys.SETTINGS, persistable);
    set(patch);
  },
}));
