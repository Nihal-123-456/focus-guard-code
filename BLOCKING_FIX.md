# FocusGuard — Blocking Fix v2

## Files changed (7 total)

| # | File | Change |
|---|------|--------|
| 1 | `android/app/src/main/java/com/focusguard/AppBlockerAccessibilityService.kt` | Use UsageStatsManager for foreground detection; reduce rate limiter from 1500ms → 300ms |
| 2 | `android/app/src/main/java/com/focusguard/AppBlockerModule.kt` | Add `isUsageAccessEnabled` + `openUsageAccessSettings` methods |
| 3 | `plugins/withFocusGuardNative.js` | Update templates to match the new .kt files; remove `noHistory` and `finishOnTaskLaunch` from overlay activity declaration |
| 4 | `src/native/AppBlocker.ts` | Add JS wrappers for `isUsageAccessEnabled` + `openUsageAccessSettings` |
| 5 | `src/components/UsageAccessCard.tsx` (NEW) | Permission card shown when Usage Access is not granted |
| 6 | `src/screens/HomeScreen.tsx` | Check Usage Access; show UsageAccessCard if missing (only when Accessibility is already granted) |
| 7 | `src/screens/SettingsScreen.tsx` | Add Usage Access status row + button to open settings |

## What the fixes do

### Fix 1: UsageStatsManager for foreground detection (THE main fix)
The old `currentForegroundPackage()` used `rootInActiveWindow?.packageName`, which on most devices returns the **accessibility service's own host package (FocusGuard)**, not the actual foreground app (Chrome). The watchdog was effectively blind.

The new implementation tries `UsageStatsManager.queryUsageStats()` first — the official Android API for finding the current foreground app. Falls back to `rootInActiveWindow` only if usage access is not granted.

### Fix 2: Removed `noHistory` and `finishOnTaskLaunch` from overlay activity
These manifest flags were causing the overlay to dismiss prematurely whenever the user pressed Home or switched apps — leaving Chrome accessible. Removing them lets the overlay persist until the session ends.

### Fix 3: Reduced rate limiter from 1500ms to 300ms
The 1500ms rate limiter was too aggressive — if the user reopened Chrome within 1.5 seconds of the previous block, the new launch event was suppressed and Chrome stayed open. 300ms is enough to dedupe burst events without blocking legitimate re-launches.

### Fix 4: Usage Access permission UI
- New `UsageAccessCard` component (similar to the existing `PermissionCard` for Accessibility)
- Shown on Home screen only when Accessibility is granted but Usage Access is not (avoids stacking two cards)
- Settings screen now shows Usage Access status row + button to open system settings
- Card auto-disappears once permission is granted (status is re-checked on screen focus and pull-to-refresh)

## Next steps

### Step 1: Copy the 7 files into your project

Replace these files in your `focus-guard-code-main/` directory:

```
focus-guard-code-main/
├── android/app/src/main/java/com/focusguard/
│   ├── AppBlockerAccessibilityService.kt    ← REPLACE
│   └── AppBlockerModule.kt                  ← REPLACE
├── plugins/
│   └── withFocusGuardNative.js              ← REPLACE
└── src/
    ├── native/
    │   └── AppBlocker.ts                    ← REPLACE
    ├── components/
    │   └── UsageAccessCard.tsx              ← NEW FILE
    └── screens/
        ├── HomeScreen.tsx                   ← REPLACE
        └── SettingsScreen.tsx               ← REPLACE
```

### Step 2: Clean the Gradle build cache

```bash
cd android
./gradlew clean
cd ..
```

This deletes compiled outputs only — your source files are untouched. Required because the old `.class` files for the previous `AppBlockerModule` (without the new `isUsageAccessEnabled` method) would otherwise persist.

### Step 3: Re-run prebuild (regenerates native files from the updated plugin)

```bash
npx expo prebuild --platform android
```

This re-runs the `withFocusGuardNative` plugin, which:
- Writes the new `AppBlockerAccessibilityService.kt` (with UsageStatsManager)
- Writes the new `AppBlockerModule.kt` (with `isUsageAccessEnabled` / `openUsageAccessSettings`)
- **Removes `noHistory` and `finishOnTaskLaunch` from the overlay activity in `AndroidManifest.xml`** (the plugin now actively deletes these attributes if they were set by a previous prebuild)

Do NOT use `--clean` here — that would delete your hand-edited native files. Plain `prebuild` merges the plugin's changes without destroying your work.

### Step 4: Rebuild and install

```bash
npx expo run:android
```

### Step 5: Grant BOTH permissions on your phone

After the app installs:

1. **Accessibility** (if you haven't already): Android Settings → Accessibility → FocusGuard → toggle ON
2. **Usage Access** (NEW): Android Settings → Apps → Special app access → Usage access → FocusGuard → toggle ON

   Alternatively, open FocusGuard → Settings tab → tap "Open usage access settings".

The Home screen will show a yellow "Grant Usage Access" card if the permission is missing. Once you grant it, pull-to-refresh on the Home screen (or navigate away and back) and the card will disappear.

### Step 6: Verify blocking works

1. Open FocusGuard → Apps tab → blacklist Chrome
2. Go to Home → Start focus session (1 hour)
3. Press Home, then open Chrome
4. You should see the dark "FocusGuard is blocking this app" overlay appear over Chrome within ~400ms

To verify via logcat:
```bash
adb logcat -s FocusGuardBlocker
```

You should see:
- `Accessibility service connected` (on app launch)
- `✅ Blocking activated for 1 packages: [com.android.chrome]` (on session start)
- `🚫 Blocking foreground package: com.android.chrome` (when you open Chrome)

## Troubleshooting

### "Blocking still doesn't work after the fix"

Most likely cause: **Usage Access permission not granted.** Check:
- Open FocusGuard → Settings tab → look at the "Usage access" row
- If it says "Disabled", tap "Open usage access settings" and grant it
- Go back to FocusGuard → pull-to-refresh on Settings

### "The card doesn't disappear after I grant Usage Access"

The card auto-hides when the Home screen re-checks permissions. To force a re-check:
- Pull down on the Home screen (pull-to-refresh), OR
- Switch to another tab and back (the `useFocusEffect` re-checks on focus)

### "Overlay appears but Chrome is still visible behind it"

This is expected — the overlay is opaque (`#0E1726` background), so it should fully cover Chrome. If you can see Chrome around the edges, your device may be in split-screen or picture-in-picture mode. Exit split-screen and try again.

### "Overlay appears, then disappears after a few seconds"

Check that `noHistory` and `finishOnTaskLaunch` are actually removed from the manifest:
```bash
grep -E "noHistory|finishOnTaskLaunch" android/app/src/main/AndroidManifest.xml
```
If you see either attribute on the `BlockingOverlayActivity`, re-run `npx expo prebuild --platform android` (without `--clean`) — the plugin should remove them.

### "UsageStatsManager queryUsageStats returns empty"

Some OEM ROMs (MIUI, EMUI) restrict UsageStatsManager even after the user grants Usage Access. As a workaround, also enable "Autostart" permission for FocusGuard in your phone's settings (MIUI-specific). On stock Android and Pixel, this works out of the box.
