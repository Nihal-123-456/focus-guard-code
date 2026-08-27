/** Known communication-app package names that should support call passthrough. */
export const CALL_PASSTHROUGH_PACKAGES = [
  'com.android.dialer',           // Google Phone
  'com.samsung.android.dialer',   // Samsung Phone
  'com.android.phone',            // Legacy phone
  'com.whatsapp',                 // WhatsApp
  'org.telegram.messenger',       // Telegram
  'com.facebook.orca',            // Messenger
  'com.ril.JioDsignVoLTE',        // Jio
  'com.android.google.dialer',    // Pixel phone
  // imo (varies by region — common variants):
  'com.imo.android.imoim',        // imo
  'com.imo.android.imoimhd',
];

/** Convenience set for O(1) lookup. */
export const CALL_PASSTHROUGH_SET = new Set(CALL_PASSTHROUGH_PACKAGES);

/** Whether the given package is a known communication app. */
export function isCommunicationApp(packageName: string): boolean {
  return CALL_PASSTHROUGH_SET.has(packageName);
}

/** Whether a blacklisted app should allow call passthrough. */
export function shouldAllowCallPassthrough(
  packageName: string,
  settingEnabled: boolean,
): boolean {
  if (!settingEnabled) return false;
  return isCommunicationApp(packageName);
}
