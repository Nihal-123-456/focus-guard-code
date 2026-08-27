/**
 * Bridge to native `AppBlockerModule` (Android).
 *
 * Controls the AccessibilityService that intercepts app launches during
 * an active focus session.
 *
 * In mock mode (no native module), all methods are no-ops.
 */
import { NativeModules, Platform } from 'react-native';
import type { NativeBlockerStatus } from '../types';

const NativeModule = NativeModules.AppBlocker;
const isAvailable = Platform.OS === 'android' && !!NativeModule;

export const AppBlocker = {
  isAvailable,

  /** Whether the user has granted the Accessibility permission. */
  async isAccessibilityEnabled(): Promise<boolean> {
    if (!isAvailable) return false;
    try {
      return await NativeModule.isAccessibilityEnabled();
    } catch (e) {
      console.warn('[AppBlocker] isAccessibilityEnabled failed:', e);
      return false;
    }
  },

  /** Open the system Accessibility settings so the user can grant permission. */
  async openAccessibilitySettings(): Promise<void> {
    if (!isAvailable) return;
    await NativeModule.openAccessibilitySettings();
  },

  /**
   * Activate blocking for the given package list.
   * The accessibility service will intercept and prevent launches of these apps.
   */
  async activateBlocking(packageNames: string[]): Promise<void> {
    if (!isAvailable) {
      console.warn('[AppBlocker] mock mode — activateBlocking no-op');
      return;
    }
    await NativeModule.activateBlocking(packageNames);
  },

  /** Deactivate blocking (when session ends). */
  async deactivateBlocking(): Promise<void> {
    if (!isAvailable) return;
    await NativeModule.deactivateBlocking();
  },

  /** Get the current blocker status (for diagnostics / Settings screen). */
  async getStatus(): Promise<NativeBlockerStatus> {
    if (!isAvailable) {
      return {
        isAccessibilityEnabled: false,
        isBlockingActive: false,
        blockedPackage: null,
        lastBlockedAt: null,
      };
    }
    return await NativeModule.getStatus();
  },
};
