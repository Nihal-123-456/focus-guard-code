package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.SharedPreferences
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class AppBlockerAccessibilityService : AccessibilityService() {
    companion object {
        private const val TAG = "FocusGuardBlocker"
        private const val APP_BLOCKER_PREFS = "focusguard_app_blocker"
        private const val KEY_BLOCKING_ACTIVE = "blocking_active"
        private const val KEY_BLOCKED_PACKAGES = "blocked_packages"
        private const val KEY_LAST_BLOCKED_PACKAGE = "last_blocked_package"
        private const val KEY_LAST_BLOCKED_AT = "last_blocked_at"
        private const val WATCHDOG_INTERVAL_MS = 500L
        private const val RATE_LIMIT_MS = 1000L
        // How recent must UsageStatsManager.lastTimeUsed be to consider the app "foreground"?
        // 2 seconds is tight enough to avoid stale data, loose enough to handle lag.
        private const val USAGE_STATS_FRESH_MS = 2000L
        // How many consecutive polls must report the same blocked app before we show the overlay?
        // This filters out stale events and momentary glitches.
        // At 500ms poll interval, 2 confirmations = 1 second of consistent detection.
        private const val CONFIRMATION_COUNT = 2
        // After showing the overlay, ignore "FocusGuard is foreground" events for this long.
        // Showing the overlay itself triggers an accessibility event for com.focusguard.
        private const val OVERLAY_SHOW_COOLDOWN_MS = 5000L
        // How recently must the overlay have been shown to consider it "active"?
        // If the overlay was shown within this window and we detect FocusGuard as foreground,
        // it's almost certainly the overlay itself triggering the event, not the user.
        private const val OVERLAY_RECENT_MS = 5000L
    }

    private val handler = Handler(Looper.getMainLooper())

    /**
     * PRIMARY foreground detection: poll UsageStatsManager every 500ms.
     * On MIUI, accessibility events are unreliable (suppressed for protected
     * apps, delayed by tens of seconds for others). UsageStatsManager is
     * updated by the system more reliably, though with some lag.
     */
    @Volatile
    private var currentDetectedForeground: String = ""

    /**
     * How many consecutive polls have reported the SAME blocked app?
     * We only show the overlay after CONFIRMATION_COUNT consecutive detections.
     */
    @Volatile
    private var pendingConfirmationPackage: String = ""
    @Volatile
    private var pendingConfirmationCount: Int = 0

    @Volatile
    private var lastOverlayShownAt: Long = 0L

    private val watchdogRunnable = object : Runnable {
        override fun run() {
            if (shouldWatchdogRun()) {
                pollForegroundAndMaybeBlock()
            }
            handler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    private fun prefs(): SharedPreferences =
        getSharedPreferences(APP_BLOCKER_PREFS, 0)

    private fun shouldWatchdogRun(): Boolean =
        prefs().getBoolean(KEY_BLOCKING_ACTIVE, false)

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "Accessibility service connected (v9 polling mode)")
        startWatchdog()
    }

    override fun onInterrupt() {
        stopWatchdog()
    }

    private fun showBlockingOverlay(targetPackage: String) {
        val pm = packageManager
        val blockedLabel = try {
            val appInfo = pm.getApplicationInfo(targetPackage, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            targetPackage
        }

        lastOverlayShownAt = System.currentTimeMillis()
        BlockingOverlayManager.show(applicationContext, targetPackage, blockedLabel)
    }

    /**
     * Poll UsageStatsManager to detect the foreground app.
     * This is the PRIMARY detection method on MIUI.
     */
    private fun detectForegroundApp(): String {
        try {
            val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
            if (usageStatsManager != null) {
                val now = System.currentTimeMillis()
                val stats = usageStatsManager.queryUsageStats(
                    UsageStatsManager.INTERVAL_BEST,
                    now - 10_000,
                    now,
                )
                if (stats != null && stats.isNotEmpty()) {
                    val sorted = stats.sortedByDescending { it.lastTimeUsed }
                    val mostRecent = sorted.first()
                    if (mostRecent.lastTimeUsed > 0 &&
                        now - mostRecent.lastTimeUsed < USAGE_STATS_FRESH_MS
                    ) {
                        return mostRecent.packageName
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "UsageStatsManager failed: ${e.message}")
        }
        return ""
    }

    private fun pollForegroundAndMaybeBlock() {
        val foreground = detectForegroundApp()
        currentDetectedForeground = foreground

        if (foreground.isBlank()) {
            // No reliable foreground detection — reset confirmation
            pendingConfirmationPackage = ""
            pendingConfirmationCount = 0
            return
        }

        // If FocusGuard itself is "foreground", check if it's the overlay triggering
        // (within cooldown) vs. the user actually opening FocusGuard.
        if (foreground == applicationContext.packageName) {
            val now = System.currentTimeMillis()
            val overlayRecent = now - lastOverlayShownAt < OVERLAY_RECENT_MS
            if (overlayRecent) {
                // The overlay is triggering this. Don't hide it.
                return
            }
            // User genuinely opened FocusGuard. Hide the overlay.
            if (BlockingOverlayManager.isShowing()) {
                Log.i(TAG, "FocusGuard genuinely foreground — hiding overlay")
                BlockingOverlayManager.hide()
            }
            pendingConfirmationPackage = ""
            pendingConfirmationCount = 0
            return
        }

        val storedPrefs = prefs()
        val blockedPackages = storedPrefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet()).orEmpty()

        if (!blockedPackages.contains(foreground)) {
            // Foreground app isn't blocked — reset confirmation
            pendingConfirmationPackage = ""
            pendingConfirmationCount = 0
            // Also hide overlay if showing (user switched to a non-blocked app)
            if (BlockingOverlayManager.isShowing()) {
                Log.i(TAG, "Non-blocked app foreground ($foreground) — hiding overlay")
                BlockingOverlayManager.hide()
            }
            return
        }

        // Foreground app IS blocked. Apply confirmation logic.
        if (pendingConfirmationPackage == foreground) {
            pendingConfirmationCount++
        } else {
            pendingConfirmationPackage = foreground
            pendingConfirmationCount = 1
        }

        if (pendingConfirmationCount < CONFIRMATION_COUNT) {
            // Need more confirmations — wait for next poll
            return
        }

        // Confirmed! Check rate limit before showing overlay.
        val now = System.currentTimeMillis()
        val lastBlockedPackage = storedPrefs.getString(KEY_LAST_BLOCKED_PACKAGE, null)
        val lastBlockedAt = if (storedPrefs.contains(KEY_LAST_BLOCKED_AT)) {
            storedPrefs.getLong(KEY_LAST_BLOCKED_AT, 0L)
        } else {
            0L
        }
        // If overlay is already showing for this app, don't re-show
        if (BlockingOverlayManager.isShowing() &&
            lastBlockedPackage == foreground &&
            now - lastBlockedAt < RATE_LIMIT_MS
        ) {
            return
        }

        Log.i(TAG, "🚫 Confirmed blocked app in foreground: $foreground (after $pendingConfirmationCount polls)")
        storedPrefs.edit()
            .putString(KEY_LAST_BLOCKED_PACKAGE, foreground)
            .putLong(KEY_LAST_BLOCKED_AT, now)
            .apply()

        handler.post {
            showBlockingOverlay(foreground)
        }
    }

    private fun startWatchdog() {
        handler.removeCallbacks(watchdogRunnable)
        handler.postDelayed(watchdogRunnable, WATCHDOG_INTERVAL_MS)
    }

    private fun stopWatchdog() {
        handler.removeCallbacks(watchdogRunnable)
    }

    /**
     * Accessibility events are used as a SECONDARY signal only.
     * On MIUI, they're unreliable. We mainly use them to detect when
     * the user switches to FocusGuard (to hide the overlay).
     */
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val targetPackage = event?.packageName?.toString().orEmpty()
        if (targetPackage.isBlank()) return

        // If event says FocusGuard is foreground, AND we're not in the
        // overlay-cooldown window, hide the overlay.
        if (targetPackage == applicationContext.packageName) {
            val now = System.currentTimeMillis()
            val overlayRecent = now - lastOverlayShownAt < OVERLAY_RECENT_MS
            if (!overlayRecent && BlockingOverlayManager.isShowing()) {
                Log.i(TAG, "Event: FocusGuard foreground — hiding overlay")
                BlockingOverlayManager.hide()
            }
        }
    }

    override fun onDestroy() {
        stopWatchdog()
        BlockingOverlayManager.hide()
        super.onDestroy()
    }
}
