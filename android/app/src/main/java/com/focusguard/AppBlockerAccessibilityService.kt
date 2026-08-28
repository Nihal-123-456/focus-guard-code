package com.focusguard

import android.accessibilityservice.AccessibilityService
import android.content.SharedPreferences
import android.content.Intent
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
    }

    private fun prefs(): SharedPreferences =
        getSharedPreferences(APP_BLOCKER_PREFS, 0)

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "Accessibility service connected")
    }

    private fun launchBlockingOverlay(targetPackage: String) {
        val pm = packageManager
        val blockedLabel = try {
            val appInfo = pm.getApplicationInfo(targetPackage, 0)
            pm.getApplicationLabel(appInfo).toString()
        } catch (_: Exception) {
            targetPackage
        }

        val intent = Intent(this, BlockingOverlayActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP,
            )
            putExtra(BlockingOverlayActivity.EXTRA_BLOCKED_PACKAGE, targetPackage)
            putExtra(BlockingOverlayActivity.EXTRA_BLOCKED_LABEL, blockedLabel)
        }
        startActivity(intent)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val targetPackage = event?.packageName?.toString().orEmpty()
            .ifBlank { rootInActiveWindow?.packageName?.toString().orEmpty() }
        if (targetPackage.isBlank() || targetPackage == applicationContext.packageName) return

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
        if (lastBlockedPackage == targetPackage && now - lastBlockedAt < 1500) {
            return
        }

        Log.d(TAG, "Blocking foreground package: $targetPackage")
        storedPrefs.edit()
            .putString(KEY_LAST_BLOCKED_PACKAGE, targetPackage)
            .putLong(KEY_LAST_BLOCKED_AT, now)
            .apply()

        Handler(Looper.getMainLooper()).post {
            launchBlockingOverlay(targetPackage)
        }
    }

    override fun onInterrupt() = Unit
}
