package com.focusguard

import android.accessibilityservice.AccessibilityService
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
    }

    private fun prefs(): SharedPreferences =
        getSharedPreferences(APP_BLOCKER_PREFS, 0)

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val targetPackage = event?.packageName?.toString().orEmpty()
            .ifBlank { rootInActiveWindow?.packageName?.toString().orEmpty() }
        if (targetPackage.isBlank() || targetPackage == applicationContext.packageName) return

        val storedPrefs = prefs()
        if (!storedPrefs.getBoolean(KEY_BLOCKING_ACTIVE, false)) return

        val blockedPackages = storedPrefs.getStringSet(KEY_BLOCKED_PACKAGES, emptySet()).orEmpty()
        if (!blockedPackages.contains(targetPackage)) return

        Log.d(TAG, "Blocking foreground package: $targetPackage")
        storedPrefs.edit()
            .putString(KEY_LAST_BLOCKED_PACKAGE, targetPackage)
            .putLong(KEY_LAST_BLOCKED_AT, System.currentTimeMillis())
            .apply()

        Handler(Looper.getMainLooper()).post {
            performGlobalAction(GLOBAL_ACTION_HOME)
        }
    }

    override fun onInterrupt() = Unit
}
