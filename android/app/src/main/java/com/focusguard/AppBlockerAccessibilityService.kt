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
        private const val WATCHDOG_INTERVAL_MS = 400L
        private const val RATE_LIMIT_MS = 300L
        private const val FOREGROUND_STALE_MS = 5000L
    }

    private val watchdogHandler = Handler(Looper.getMainLooper())
    private val watchdogRunnable = object : Runnable {
        override fun run() {
            if (shouldWatchdogRun()) {
                maybeEnforceForegroundPackage(currentForegroundPackage())
            }
            watchdogHandler.postDelayed(this, WATCHDOG_INTERVAL_MS)
        }
    }

    private fun prefs(): SharedPreferences =
        getSharedPreferences(APP_BLOCKER_PREFS, 0)

    private fun shouldWatchdogRun(): Boolean =
        prefs().getBoolean(KEY_BLOCKING_ACTIVE, false)

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "Accessibility service connected")
        startWatchdog()
    }

    override fun onInterrupt() {
        stopWatchdog()
    }

    /**
     * Show the blocking overlay via WindowManager (BlockingOverlayManager).
     * This draws directly on top of everything, regardless of which app
     * is in the foreground — no task management, no background-launch issues.
     */
    private fun showBlockingOverlay(targetPackage: String) {
        val pm = packageManager
        val blockedLabel = try {
            val appInfo = pm.getApplicationInfo(targetPackage, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            targetPackage
        }

        BlockingOverlayManager.show(applicationContext, targetPackage, blockedLabel)
    }

    private fun currentForegroundPackage(): String {
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
                    if (mostRecent.lastTimeUsed > 0 && now - mostRecent.lastTimeUsed < FOREGROUND_STALE_MS) {
                        return mostRecent.packageName
                    }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "UsageStatsManager failed (usage access likely not granted): ${e.message}")
        }

        return rootInActiveWindow?.packageName?.toString().orEmpty()
    }

    private fun startWatchdog() {
        watchdogHandler.removeCallbacks(watchdogRunnable)
        watchdogHandler.postDelayed(watchdogRunnable, WATCHDOG_INTERVAL_MS)
    }

    private fun stopWatchdog() {
        watchdogHandler.removeCallbacks(watchdogRunnable)
    }

    private fun maybeEnforceForegroundPackage(targetPackage: String) {
        if (targetPackage.isBlank() || targetPackage == applicationContext.packageName) {
            // If FocusGuard is in the foreground, hide any existing overlay.
            if (targetPackage == applicationContext.packageName && BlockingOverlayManager.isShowing()) {
                BlockingOverlayManager.hide()
            }
            return
        }

        val storedPrefs = prefs()
        if (!storedPrefs.getBoolean(KEY_BLOCKING_ACTIVE, false)) return

        val blockedPackages = storedPrefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet()).orEmpty()
        if (!blockedPackages.contains(targetPackage)) return

        val now = System.currentTimeMillis()
        val lastBlockedPackage = storedPrefs.getString(KEY_LAST_BLOCKED_PACKAGE, null)
        val lastBlockedAt = if (storedPrefs.contains(KEY_LAST_BLOCKED_AT)) {
            storedPrefs.getLong(KEY_LAST_BLOCKED_AT, 0L)
        } else {
            0L
        }
        if (lastBlockedPackage == targetPackage && now - lastBlockedAt < RATE_LIMIT_MS) {
            return
        }

        Log.i(TAG, "🚫 Detected blocked app in foreground: $targetPackage")
        storedPrefs.edit()
            .putString(KEY_LAST_BLOCKED_PACKAGE, targetPackage)
            .putLong(KEY_LAST_BLOCKED_AT, now)
            .apply()

        Handler(Looper.getMainLooper()).post {
            showBlockingOverlay(targetPackage)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val targetPackage = event?.packageName?.toString().orEmpty()
            .ifBlank { currentForegroundPackage() }
        maybeEnforceForegroundPackage(targetPackage)
    }

    override fun onDestroy() {
        stopWatchdog()
        BlockingOverlayManager.hide()
        super.onDestroy()
    }
}
