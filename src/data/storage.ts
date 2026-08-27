import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AsyncStorage wrapper with namespacing and JSON serialization.
 */

const NAMESPACE = '@focusguard';

function ns(key: string): string {
  return `${NAMESPACE}:${key}`;
}

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(ns(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[storage] failed to read ${key}:`, err);
    return fallback;
  }
}

export async function writeJSON<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(ns(key), JSON.stringify(value));
  } catch (err) {
    console.warn(`[storage] failed to write ${key}:`, err);
    throw err;
  }
}

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(ns(key));
  } catch (err) {
    console.warn(`[storage] failed to remove ${key}:`, err);
  }
}

/** Storage keys used throughout the app. */
export const StorageKeys = {
  BLACKLIST: 'blacklist',
  ACTIVE_SESSION: 'active_session',
  HISTORY: 'history',
  SETTINGS: 'settings',
  CACHED_APPS: 'cached_apps',
  SCHEDULES: 'schedules',
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];
