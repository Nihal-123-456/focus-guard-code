import { create } from 'zustand';
import type { InstalledApp } from '../types';
import { readJSON, writeJSON, StorageKeys } from './storage';

interface AppListState {
  apps: InstalledApp[];
  cachedAt: number | null;
  loaded: boolean;
  loading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  search: (query: string) => InstalledApp[];
}

// Lazy-import native module — falls back to mock if unavailable.
let InstalledAppsNative: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('react-native');
  InstalledAppsNative = mod.NativeModules?.InstalledApps ?? null;
} catch {
  InstalledAppsNative = null;
}

function isMock(): boolean {
  return !InstalledAppsNative || !InstalledAppsNative.listApps;
}

const MOCK_APPS: InstalledApp[] = [
  { packageName: 'com.whatsapp', label: 'WhatsApp', isLaunchable: true, isSystem: false },
  { packageName: 'com.facebook.katana', label: 'Facebook', isLaunchable: true, isSystem: false },
  { packageName: 'com.facebook.orca', label: 'Messenger', isLaunchable: true, isSystem: false },
  { packageName: 'com.instagram.android', label: 'Instagram', isLaunchable: true, isSystem: false },
  { packageName: 'com.twitter.android', label: 'X (Twitter)', isLaunchable: true, isSystem: false },
  { packageName: 'com.zhiliaoapp.musically', label: 'TikTok', isLaunchable: true, isSystem: false },
  { packageName: 'com.google.android.youtube', label: 'YouTube', isLaunchable: true, isSystem: false },
  { packageName: 'com.netflix.mediaclient', label: 'Netflix', isLaunchable: true, isSystem: false },
  { packageName: 'com.spotify.music', label: 'Spotify', isLaunchable: true, isSystem: false },
  { packageName: 'com.android.chrome', label: 'Chrome', isLaunchable: true, isSystem: true },
  { packageName: 'com.android.dialer', label: 'Phone', isLaunchable: true, isSystem: true },
  { packageName: 'com.imo.android.imoim', label: 'imo', isLaunchable: true, isSystem: false },
  { packageName: 'com.android.settings', label: 'Settings', isLaunchable: true, isSystem: true },
];

export const useAppListStore = create<AppListState>((set, get) => ({
  apps: [],
  cachedAt: null,
  loaded: false,
  loading: false,
  error: null,

  async hydrate() {
    const cached = await readJSON<{ apps: InstalledApp[]; cachedAt: number } | null>(
      StorageKeys.CACHED_APPS,
      null,
    );
    if (cached) {
      set({ apps: cached.apps, cachedAt: cached.cachedAt, loaded: true });
    } else {
      set({ loaded: true });
    }
  },

  async refresh() {
    set({ loading: true, error: null });
    try {
      let apps: InstalledApp[];
      if (isMock()) {
        // Mock fallback (Expo Go / no native module).
        apps = MOCK_APPS;
      } else {
        const raw = (await InstalledAppsNative.listApps()) as InstalledApp[];
        apps = raw
          .filter((a) => a.isLaunchable)
          .sort((a, b) => a.label.localeCompare(b.label));
      }
      const cachedAt = Date.now();
      set({ apps, cachedAt, loading: false, loaded: true });
      await writeJSON(StorageKeys.CACHED_APPS, { apps, cachedAt });
    } catch (err: any) {
      set({ loading: false, error: err?.message ?? String(err) });
      throw err;
    }
  },

  search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return get().apps;
    return get().apps.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.packageName.toLowerCase().includes(q),
    );
  },
}));

/** Returns true if the native module is unavailable (mock mode). */
export function isMockMode(): boolean {
  return isMock();
}
