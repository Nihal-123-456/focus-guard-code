/**
 * Bridge to native `InstalledAppsModule` (Android).
 *
 * Queries the Android PackageManager for all launchable apps.
 *
 * In mock mode (Expo Go / iOS / missing native module), returns a stub list
 * for development purposes.
 */
import { NativeModules, Platform } from 'react-native';
import type { InstalledApp } from '../types';

const NativeModule = NativeModules.InstalledApps;
const isAvailable = Platform.OS === 'android' && !!NativeModule;

export const InstalledApps = {
  isAvailable,

  /** List all launchable apps on the device. */
  async listApps(): Promise<InstalledApp[]> {
    if (!isAvailable) {
      throw new Error(
        'InstalledApps native module is not available. Run in a dev build (expo run:android).',
      );
    }
    const raw = (await NativeModule.listApps()) as InstalledApp[];
    return raw.sort((a, b) => a.label.localeCompare(b.label));
  },

  /** Whether we're in mock/dev mode. */
  isMockMode(): boolean {
    return !isAvailable;
  },
};
