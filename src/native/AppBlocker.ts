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
   * Whether the user has granted Usage Access (PACKAGE_USAGE_STATS) permission.
   * Required for reliable foreground-app detection via UsageStatsManager.
   */
  async isUsageAccessEnabled(): Promise<boolean> {
    if (!isAvailable) return false;
    try {
      return await NativeModule.isUsageAccessEnabled();
    } catch (e) {
      console.warn('[AppBlocker] isUsageAccessEnabled failed:', e);
      return false;
    }
  },

  /** Open the system "Usage access" settings so the user can grant permission. */
  async openUsageAccessSettings(): Promise<void> {
    if (!isAvailable) return;
    await NativeModule.openUsageAccessSettings();
  },

  /**
   * Whether the user has granted SYSTEM_ALERT_WINDOW ("draw over other apps").
   * Required on Android 10+ for the accessibility service to bring the blocking
   * overlay to the foreground over the blocked app.
   */
  async canDrawOverOtherApps(): Promise<boolean> {
    if (!isAvailable) return false;
    try {
      return await NativeModule.canDrawOverOtherApps();
    } catch (e) {
      console.warn('[AppBlocker] canDrawOverOtherApps failed:', e);
      return false;
    }
  },

  /**
   * Open the system "Display over other apps" settings for FocusGuard
   * so the user can grant the permission.
   */
  async requestDrawOverOtherApps(): Promise<void> {
    if (!isAvailable) return;
    await NativeModule.requestDrawOverOtherApps();
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
