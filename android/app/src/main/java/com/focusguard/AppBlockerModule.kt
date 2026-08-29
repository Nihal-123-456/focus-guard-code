package com.focusguard

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

private const val APP_BLOCKER_PREFS = "focusguard_app_blocker"
private const val KEY_BLOCKING_ACTIVE = "blocking_active"
private const val KEY_BLOCKED_PACKAGES = "blocked_packages"
private const val KEY_LAST_BLOCKED_PACKAGE = "last_blocked_package"
private const val KEY_LAST_BLOCKED_AT = "last_blocked_at"

class AppBlockerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppBlocker"

    private fun prefs(): SharedPreferences =
        reactApplicationContext.getSharedPreferences(APP_BLOCKER_PREFS, 0)

    private fun saveBlockingState(packageNames: Set<String>) {
        prefs().edit()
            .putBoolean(KEY_BLOCKING_ACTIVE, packageNames.isNotEmpty())
            .putStringSet(KEY_BLOCKED_PACKAGES, packageNames.toMutableSet())
            .remove(KEY_LAST_BLOCKED_PACKAGE)
            .remove(KEY_LAST_BLOCKED_AT)
            .apply()
        android.util.Log.i("FocusGuardBlocker", "✅ Blocking activated for ${packageNames.size} packages: $packageNames")
    }

    private fun clearBlockingState() {
        prefs().edit()
            .putBoolean(KEY_BLOCKING_ACTIVE, false)
            .putStringSet(KEY_BLOCKED_PACKAGES, mutableSetOf())
            .remove(KEY_LAST_BLOCKED_PACKAGE)
            .remove(KEY_LAST_BLOCKED_AT)
            .apply()
        android.util.Log.i("FocusGuardBlocker", "✅ Blocking deactivated")
    }

    private fun buildStatus(): WritableMap {
        val storedPrefs = prefs()
        val status = Arguments.createMap()
        status.putBoolean("isAccessibilityEnabled", isAccessibilityServiceEnabled())
        status.putBoolean("isUsageAccessEnabled", isUsageAccessEnabled())
        status.putBoolean("isBlockingActive", storedPrefs.getBoolean(KEY_BLOCKING_ACTIVE, false))
        status.putString("blockedPackage", storedPrefs.getString(KEY_LAST_BLOCKED_PACKAGE, null))
        if (storedPrefs.contains(KEY_LAST_BLOCKED_AT)) {
            status.putDouble("lastBlockedAt", storedPrefs.getLong(KEY_LAST_BLOCKED_AT, 0L).toDouble())
        } else {
            status.putNull("lastBlockedAt")
        }
        return status
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val enabledServices = Settings.Secure.getString(
            reactApplicationContext.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ).orEmpty()
        val serviceName = ComponentName(
            reactApplicationContext,
            AppBlockerAccessibilityService::class.java,
        ).flattenToString()
        return enabledServices.split(':').any { it.equals(serviceName, ignoreCase = true) }
    }

    private fun isUsageAccessEnabled(): Boolean {
        val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName,
            )
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactApplicationContext.packageName,
            )
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("ACCESSIBILITY_SETTINGS_ERROR", error)
        }
    }

    @ReactMethod
    fun isAccessibilityEnabled(promise: Promise) {
        try {
            promise.resolve(isAccessibilityServiceEnabled())
        } catch (error: Exception) {
            promise.reject("ACCESSIBILITY_STATUS_ERROR", error)
        }
    }

    @ReactMethod
    fun isUsageAccessEnabled(promise: Promise) {
        try {
            promise.resolve(isUsageAccessEnabled())
        } catch (error: Exception) {
            promise.reject("USAGE_ACCESS_STATUS_ERROR", error)
        }
    }

    @ReactMethod
    fun openUsageAccessSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("USAGE_ACCESS_SETTINGS_ERROR", error)
        }
    }

    @ReactMethod
    fun activateBlocking(packageNames: ReadableArray, promise: Promise) {
        try {
            val packages = mutableSetOf<String>()
            for (index in 0 until packageNames.size()) {
                val value = packageNames.getString(index)
                if (!value.isNullOrBlank()) {
                    packages.add(value)
                }
            }
            saveBlockingState(packages)
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("ACTIVATE_BLOCKING_ERROR", error)
        }
    }

    @ReactMethod
    fun deactivateBlocking(promise: Promise) {
        try {
            clearBlockingState()
            promise.resolve(null)
        } catch (error: Exception) {
            promise.reject("DEACTIVATE_BLOCKING_ERROR", error)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        try {
            promise.resolve(buildStatus())
        } catch (error: Exception) {
            promise.reject("BLOCKER_STATUS_ERROR", error)
        }
    }
}
