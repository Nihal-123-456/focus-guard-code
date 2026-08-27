import { create } from 'zustand';
import type { HistoryEntry } from '../types';
import { readJSON, writeJSON, StorageKeys } from './storage';

interface HistoryState {
  entries: HistoryEntry[];
  loaded: boolean;

  hydrate: () => Promise<void>;
  addEntry: (entry: HistoryEntry) => Promise<void>;
  clear: () => Promise<void>;

  /** Total ms spent in completed or aborted sessions. */
  getTotalBlockedMs: () => number;
  /** Total ms in the last N days. */
  getRecentBlockedMs: (days: number) => number;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  entries: [],
  loaded: false,

  async hydrate() {
    const entries = await readJSON<HistoryEntry[]>(StorageKeys.HISTORY, []);
    // Keep newest first.
    entries.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    set({ entries, loaded: true });
  },

  async addEntry(entry) {
    const next = [entry, ...get().entries].slice(0, 500); // cap history
    set({ entries: next });
    await writeJSON(StorageKeys.HISTORY, next);
  },

  async clear() {
    set({ entries: [] });
    await writeJSON(StorageKeys.HISTORY, []);
  },

  getTotalBlockedMs() {
    return get().entries.reduce((sum, e) => sum + e.actualDurationMs, 0);
  },

  getRecentBlockedMs(days) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return get()
      .entries.filter((e) => e.startedAt >= cutoff)
      .reduce((sum, e) => sum + e.actualDurationMs, 0);
  },
}));
