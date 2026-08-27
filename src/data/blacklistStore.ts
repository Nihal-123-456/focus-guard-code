import { create } from 'zustand';
import type { BlacklistEntry, InstalledApp } from '../types';
import { readJSON, writeJSON, StorageKeys } from './storage';
import { isCommunicationApp } from '../utils/constants';

interface BlacklistState {
  entries: BlacklistEntry[];
  /** Snapshot of the blacklist at the start of an active session (frozen). */
  sessionSnapshot: string[] | null;
  loaded: boolean;

  /** Hydrate from AsyncStorage. */
  hydrate: () => Promise<void>;
  /** Persist current state to AsyncStorage. */
  persist: () => Promise<void>;

  /** Add an app to the blacklist (no-op if already present). */
  add: (app: InstalledApp) => Promise<void>;
  /** Remove an app from the blacklist. Refuses if a session is active. */
  remove: (packageName: string) => Promise<boolean>;
  /** Remove all blacklisted apps. */
  clear: () => Promise<void>;

  /** Check if a package is currently blacklisted. */
  isBlacklisted: (packageName: string) => boolean;
  /** Get all blacklisted package names (or snapshot if session active). */
  getBlacklistedPackages: () => string[];

  /** Freeze current blacklist into session snapshot. */
  freezeSnapshot: () => void;
  /** Clear the session snapshot (call when session ends). */
  clearSnapshot: () => void;
}

export const useBlacklistStore = create<BlacklistState>((set, get) => ({
  entries: [],
  sessionSnapshot: null,
  loaded: false,

  async hydrate() {
    const entries = await readJSON<BlacklistEntry[]>(StorageKeys.BLACKLIST, []);
    set({ entries, loaded: true });
  },

  async persist() {
    await writeJSON(StorageKeys.BLACKLIST, get().entries);
  },

  async add(app) {
    const exists = get().entries.some((e) => e.packageName === app.packageName);
    if (exists) return;
    const entry: BlacklistEntry = {
      packageName: app.packageName,
      addedAt: Date.now(),
      allowCallPassthrough: isCommunicationApp(app.packageName),
    };
    set({ entries: [...get().entries, entry] });
    await get().persist();
  },

  async remove(packageName) {
    if (get().sessionSnapshot !== null) {
      // Hard-lock: refuse removal during active session.
      return false;
    }
    const next = get().entries.filter((e) => e.packageName !== packageName);
    set({ entries: next });
    await get().persist();
    return true;
  },

  async clear() {
    if (get().sessionSnapshot !== null) return;
    set({ entries: [] });
    await get().persist();
  },

  isBlacklisted(packageName) {
    // If session is active, use the snapshot.
    const snap = get().sessionSnapshot;
    if (snap !== null) return snap.includes(packageName);
    return get().entries.some((e) => e.packageName === packageName);
  },

  getBlacklistedPackages() {
    const snap = get().sessionSnapshot;
    if (snap !== null) return snap;
    return get().entries.map((e) => e.packageName);
  },

  freezeSnapshot() {
    set({ sessionSnapshot: get().entries.map((e) => e.packageName) });
  },

  clearSnapshot() {
    set({ sessionSnapshot: null });
  },
}));
