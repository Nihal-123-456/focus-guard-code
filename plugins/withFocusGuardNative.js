const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const appBlockerModule = `package __PACKAGE__

import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.net.Uri
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
        android.util.Log.i("FocusGuardBlocker", "✅ Blocking activated for \${packageNames.size} packages: \$packageNames")
    }

    private fun clearBlockingState() {
        prefs().edit()
            .putBoolean(KEY_BLOCKING_ACTIVE, false)
            .putStringSet(KEY_BLOCKED_PACKAGES, mutableSetOf())
            .remove(KEY_LAST_BLOCKED_PACKAGE)
            .remove(KEY_LAST_BLOCKED_AT)
            .apply()
        BlockingOverlayManager.hide()
        android.util.Log.i("FocusGuardBlocker", "✅ Blocking deactivated")
    }

    private fun buildStatus(): WritableMap {
        val storedPrefs = prefs()
        val status = Arguments.createMap()
        status.putBoolean("isAccessibilityEnabled", isAccessibilityServiceEnabled())
        status.putBoolean("isUsageAccessEnabled", isUsageAccessEnabled())
        status.putBoolean("canDrawOverOtherApps", canDrawOverOtherApps())
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

    private fun canDrawOverOtherApps(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(reactApplicationContext)
        } else {
            true
        }
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
    fun canDrawOverOtherApps(promise: Promise) {
        try {
            promise.resolve(canDrawOverOtherApps())
        } catch (error: Exception) {
            promise.reject("OVERLAY_PERMISSION_STATUS_ERROR", error)
        }
    }

    @ReactMethod
    fun requestDrawOverOtherApps(promise: Promise) {
        try {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:\${reactApplicationContext.packageName}"),
            ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (error: Exception) {
            try {
                val fallback = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                    .setData(Uri.parse("package:\${reactApplicationContext.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallback)
                promise.resolve(null)
            } catch (e2: Exception) {
                promise.reject("OVERLAY_PERMISSION_SETTINGS_ERROR", e2)
            }
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
`;

const installedAppsModule = `package __PACKAGE__

import android.content.Intent
import android.content.pm.ApplicationInfo
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class InstalledAppsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "InstalledApps"

    @ReactMethod
    fun listApps(promise: Promise) {
        try {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
            val apps = reactApplicationContext.packageManager.queryIntentActivities(intent, 0)
                .map { it.activityInfo.applicationInfo }
                .distinctBy { it.packageName }
                .map { appInfo ->
                    Arguments.createMap().apply {
                        putString("packageName", appInfo.packageName)
                        putString("label", appInfo.loadLabel(reactApplicationContext.packageManager).toString())
                        putBoolean("isLaunchable", true)
                        putBoolean("isSystem", appInfo.flags and ApplicationInfo.FLAG_SYSTEM != 0)
                    }
                }
            val result = Arguments.createArray()
            apps.forEach { result.pushMap(it) }
            promise.resolve(result)
        } catch (error: Exception) {
            promise.reject("INSTALLED_APPS_ERROR", error)
        }
    }
}
`;

const appBlockerPackage = `package __PACKAGE__

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AppBlockerPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(AppBlockerModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const installedAppsPackage = `package __PACKAGE__

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class InstalledAppsPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(InstalledAppsModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
`;

const accessibilityService = `package __PACKAGE__

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
            Log.w(TAG, "UsageStatsManager failed: \${e.message}")
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
`;

const blockingOverlayActivity = `package __PACKAGE__

import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class BlockingOverlayActivity : AppCompatActivity() {
    companion object {
        private const val APP_BLOCKER_PREFS = "focusguard_app_blocker"
        private const val KEY_BLOCKING_ACTIVE = "blocking_active"
        const val EXTRA_BLOCKED_PACKAGE = "blocked_package"
        const val EXTRA_BLOCKED_LABEL = "blocked_label"
    }

    private val monitorHandler = Handler(Looper.getMainLooper())
    private val monitorRunnable = object : Runnable {
        override fun run() {
            if (!isBlockingActive()) {
                finish()
                return
            }
            monitorHandler.postDelayed(this, 1000)
        }
    }

    private fun prefs(): SharedPreferences =
        getSharedPreferences(APP_BLOCKER_PREFS, 0)

    private fun isBlockingActive(): Boolean =
        prefs().getBoolean(KEY_BLOCKING_ACTIVE, false)

    private fun renderPackageLabel(intent: Intent?) {
        val packageName = intent?.getStringExtra(EXTRA_BLOCKED_PACKAGE).orEmpty()
        val blockedLabel = intent?.getStringExtra(EXTRA_BLOCKED_LABEL).orEmpty()
        findViewById<TextView>(R.id.blockingPackage).text = when {
            blockedLabel.isNotBlank() && packageName.isNotBlank() -> "\$blockedLabel (\$packageName)"
            blockedLabel.isNotBlank() -> blockedLabel
            packageName.isNotBlank() -> packageName
            else -> getString(R.string.app_name)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocking_overlay)
        renderPackageLabel(intent)
    }

    override fun onResume() {
        super.onResume()
        if (!isBlockingActive()) {
            finish()
            return
        }
        monitorHandler.removeCallbacks(monitorRunnable)
        monitorHandler.post(monitorRunnable)
    }

    override fun onPause() {
        super.onPause()
        monitorHandler.removeCallbacks(monitorRunnable)
    }

    override fun onBackPressed() {
        // Intentionally disabled. The overlay is only dismissed when the session ends.
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        renderPackageLabel(intent)
    }
}
`;

const blockingOverlayManager = `package __PACKAGE__

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView

/**
 * Manages a full-screen system overlay window that blocks the user from
 * interacting with blacklisted apps.
 *
 * Uses WindowManager.addView() with TYPE_APPLICATION_OVERLAY.
 */
object BlockingOverlayManager {
    private const val TAG = "FocusGuardBlocker"
    private const val APP_BLOCKER_PREFS = "focusguard_app_blocker"
    private const val KEY_BLOCKING_ACTIVE = "blocking_active"
    private const val MONITOR_INTERVAL_MS = 1000L

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private val handler = Handler(Looper.getMainLooper())
    private var monitorRunnable: Runnable? = null
    private var appContext: Context? = null
    private var currentBlockedPackage: String = ""

    fun show(context: Context, targetPackage: String, blockedLabel: String) {
        appContext = context.applicationContext
        handler.post {
            try {
                // If overlay is already showing for the SAME package, do nothing
                if (overlayView != null && currentBlockedPackage == targetPackage) {
                    return@post
                }

                // If overlay is showing for a DIFFERENT package, update the label
                if (overlayView != null) {
                    currentBlockedPackage = targetPackage
                    updateLabel(targetPackage, blockedLabel)
                    Log.i(TAG, "✅ Overlay updated for $targetPackage")
                    return@post
                }

                Log.i(TAG, "→ Showing overlay for $targetPackage (label=$blockedLabel)")

                val wm = appContext!!.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                windowManager = wm

                val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                } else {
                    @Suppress("DEPRECATION")
                    WindowManager.LayoutParams.TYPE_PHONE
                }

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    layoutType,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    PixelFormat.TRANSLUCENT,
                )
                params.gravity = Gravity.TOP or Gravity.LEFT
                params.x = 0
                params.y = 0

                val view = LayoutInflater.from(appContext).inflate(
                    R.layout.activity_blocking_overlay,
                    null,
                )
                updateViewLabel(view, targetPackage, blockedLabel)

                wm.addView(view, params)
                overlayView = view
                currentBlockedPackage = targetPackage

                Log.i(TAG, "✅ Overlay shown for $targetPackage")
                startMonitor()
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to show overlay: \${e.message}", e)
            }
        }
    }

    private fun updateLabel(targetPackage: String, blockedLabel: String) {
        val view = overlayView ?: return
        updateViewLabel(view, targetPackage, blockedLabel)
    }

    private fun updateViewLabel(view: View, targetPackage: String, blockedLabel: String) {
        val labelView = view.findViewById<TextView>(R.id.blockingPackage)
        labelView?.text = when {
            blockedLabel.isNotBlank() && targetPackage.isNotBlank() ->
                "$blockedLabel ($targetPackage)"
            blockedLabel.isNotBlank() -> blockedLabel
            targetPackage.isNotBlank() -> targetPackage
            else -> appContext?.getString(R.string.app_name) ?: "FocusGuard"
        }
    }

    private fun startMonitor() {
        stopMonitor()
        val runnable = object : Runnable {
            override fun run() {
                val ctx = appContext ?: return
                val prefs = ctx.getSharedPreferences(APP_BLOCKER_PREFS, 0)
                if (!prefs.getBoolean(KEY_BLOCKING_ACTIVE, false)) {
                    Log.i(TAG, "Session ended — hiding overlay")
                    hide()
                    return
                }
                handler.postDelayed(this, MONITOR_INTERVAL_MS)
            }
        }
        monitorRunnable = runnable
        handler.post(runnable)
    }

    private fun stopMonitor() {
        monitorRunnable?.let { handler.removeCallbacks(it) }
        monitorRunnable = null
    }

    fun hide() {
        handler.post {
            try {
                val view = overlayView
                val wm = windowManager
                if (view != null && wm != null) {
                    wm.removeView(view)
                }
                overlayView = null
                windowManager = null
                currentBlockedPackage = ""
                stopMonitor()
                Log.i(TAG, "Overlay hidden")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to hide overlay: \${e.message}", e)
            }
        }
    }

    fun isShowing(): Boolean = overlayView != null
}
`;

const blockingOverlayLayout = `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/blocking_overlay_background"
    android:clickable="true"
    android:focusable="true"
    android:keepScreenOn="true"
    android:padding="24dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:orientation="vertical">

        <TextView
            android:id="@+id/blockingIcon"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginBottom="18dp"
            android:text="LOCKED"
            android:textColor="@color/blocking_overlay_accent"
            android:textSize="15sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/blockingTitle"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginBottom="12dp"
            android:gravity="center"
            android:text="@string/blocking_overlay_title"
            android:textColor="@color/blocking_overlay_text"
            android:textSize="26sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/blockingMessage"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginBottom="20dp"
            android:gravity="center"
            android:lineSpacingExtra="2dp"
            android:text="@string/blocking_overlay_message"
            android:textColor="@color/blocking_overlay_subtext"
            android:textSize="16sp" />

        <TextView
            android:id="@+id/blockingPackage"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:background="@color/blocking_overlay_surface"
            android:paddingLeft="14dp"
            android:paddingTop="10dp"
            android:paddingRight="14dp"
            android:paddingBottom="10dp"
            android:textColor="@color/blocking_overlay_text"
            android:textSize="13sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/blockingHint"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="18dp"
            android:gravity="center"
            android:lineSpacingExtra="2dp"
            android:text="@string/blocking_overlay_hint"
            android:textColor="@color/blocking_overlay_subtext"
            android:textSize="13sp" />
    </LinearLayout>
</FrameLayout>
`;

const overlayStyles = `
  <style name="Theme.FocusGuard.BlockingOverlay" parent="Theme.AppCompat.Light.NoActionBar">
    <item name="android:windowNoTitle">true</item>
    <item name="android:windowFullscreen">true</item>
    <item name="android:statusBarColor">@color/blocking_overlay_background</item>
    <item name="android:navigationBarColor">@color/blocking_overlay_background</item>
    <item name="android:windowBackground">@color/blocking_overlay_background</item>
    <item name="android:textColor">@color/blocking_overlay_text</item>
  </style>
`;

const overlayColors = `
  <color name="blocking_overlay_background">#0E1726</color>
  <color name="blocking_overlay_surface">#162033</color>
  <color name="blocking_overlay_text">#F7FAFC</color>
  <color name="blocking_overlay_subtext">#C9D4E3</color>
  <color name="blocking_overlay_accent">#FFB703</color>
`;

const overlayStrings = `
  <string name="blocking_overlay_title">FocusGuard is blocking this app</string>
  <string name="blocking_overlay_message">This app is locked for the current focus session. Return to FocusGuard and wait until the timer ends.</string>
  <string name="blocking_overlay_hint">If this feels wrong, open FocusGuard from the launcher to check your session status.</string>
`;

const accessibilityConfig = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="true"
    android:description="@string/accessibility_service_description" />
`;

function sourceFor(template, packageName) {
  return template.replaceAll('__PACKAGE__', packageName);
}

function withNativeSources(config) {
  return withDangerousMod(config, ['android', async (config) => {
    const androidRoot = config.modRequest.platformProjectRoot;
    const packageName = config.android.package;
    const packagePath = packageName.split('.');
    const javaDirectory = path.join(androidRoot, 'app', 'src', 'main', 'java', ...packagePath);
    const resDirectory = path.join(androidRoot, 'app', 'src', 'main', 'res');
    const valuesDirectory = path.join(resDirectory, 'values');
    const xmlDirectory = path.join(resDirectory, 'xml');
    const layoutDirectory = path.join(resDirectory, 'layout');
    const applicationPath = path.join(javaDirectory, 'MainApplication.kt');

    fs.mkdirSync(javaDirectory, { recursive: true });
    fs.mkdirSync(valuesDirectory, { recursive: true });
    fs.mkdirSync(xmlDirectory, { recursive: true });
    fs.mkdirSync(layoutDirectory, { recursive: true });

    const sources = {
      'AppBlockerModule.kt': appBlockerModule,
      'AppBlockerPackage.kt': appBlockerPackage,
      'InstalledAppsModule.kt': installedAppsModule,
      'InstalledAppsPackage.kt': installedAppsPackage,
      'AppBlockerAccessibilityService.kt': accessibilityService,
      'BlockingOverlayActivity.kt': blockingOverlayActivity,
      'BlockingOverlayManager.kt': blockingOverlayManager,
    };
    for (const [filename, template] of Object.entries(sources)) {
      fs.writeFileSync(path.join(javaDirectory, filename), sourceFor(template, packageName));
    }
    fs.writeFileSync(path.join(xmlDirectory, 'accessibility_service_config.xml'), accessibilityConfig);
    fs.writeFileSync(path.join(layoutDirectory, 'activity_blocking_overlay.xml'), blockingOverlayLayout);

    const stringsPath = path.join(valuesDirectory, 'strings.xml');
    let strings = fs.existsSync(stringsPath)
      ? fs.readFileSync(stringsPath, 'utf8')
      : '<resources>\n</resources>\n';
    if (!strings.includes('name="accessibility_service_description"')) {
      strings = strings.replace('</resources>', `  <string name="accessibility_service_description">Allows FocusGuard to monitor app launches during focus sessions.</string>\n${overlayStrings}</resources>`);
      fs.writeFileSync(stringsPath, strings);
    } else if (!strings.includes('name="blocking_overlay_title"')) {
      strings = strings.replace('</resources>', `${overlayStrings}</resources>`);
      fs.writeFileSync(stringsPath, strings);
    }

    const colorsPath = path.join(valuesDirectory, 'colors.xml');
    let colors = fs.existsSync(colorsPath)
      ? fs.readFileSync(colorsPath, 'utf8')
      : '<resources>\n</resources>\n';
    if (!colors.includes('name="blocking_overlay_background"')) {
      colors = colors.replace('</resources>', `${overlayColors}</resources>`);
      fs.writeFileSync(colorsPath, colors);
    }

    const stylesPath = path.join(valuesDirectory, 'styles.xml');
    let styles = fs.existsSync(stylesPath)
      ? fs.readFileSync(stylesPath, 'utf8')
      : '<resources xmlns:tools="http://schemas.android.com/tools">\n</resources>\n';
    if (!styles.includes('name="Theme.FocusGuard.BlockingOverlay"')) {
      styles = styles.replace('</resources>', `${overlayStyles}\n</resources>`);
      fs.writeFileSync(stylesPath, styles);
    }

    let application = fs.readFileSync(applicationPath, 'utf8');
    if (!application.includes('packages.add(AppBlockerPackage())')) {
      application = application.replace(
        'val packages = PackageList(this).packages',
        'val packages = PackageList(this).packages\n            packages.add(AppBlockerPackage())\n            packages.add(InstalledAppsPackage())',
      );
      fs.writeFileSync(applicationPath, application);
    }

    return config;
  }]);
}

function withServiceManifest(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (!application) return config;

    application.service = application.service || [];
    const alreadyDeclared = application.service.some(
      (service) => service.$?.['android:name'] === '.AppBlockerAccessibilityService',
    );
    if (!alreadyDeclared) {
      application.service.push({
        $: {
          'android:name': '.AppBlockerAccessibilityService',
          'android:exported': 'false',
          'android:label': '@string/app_name',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }],
        }],
        'meta-data': [{
          $: {
            'android:name': 'android.accessibilityservice',
            'android:resource': '@xml/accessibility_service_config',
          },
        }],
      });
    }

    // IMPORTANT: The overlay activity must NOT have:
    //   - taskAffinity="" (causes it to launch in a separate background task
    //     that cannot be brought to foreground on Android 10+)
    //   - excludeFromRecents="true" (interferes with task switching)
    //   - noHistory="true" (causes premature dismissal)
    //   - finishOnTaskLaunch="true" (causes premature dismissal)
    //
    // The overlay lives in FocusGuard's main task. When launched with
    // FLAG_ACTIVITY_NEW_TASK, it brings FocusGuard's task to the foreground,
    // covering the blocked app.
    application.activity = application.activity || [];
    const overlayAlreadyDeclared = application.activity.some(
      (activity) => activity.$?.['android:name'] === '.BlockingOverlayActivity',
    );
    if (!overlayAlreadyDeclared) {
      application.activity.push({
        $: {
          'android:name': '.BlockingOverlayActivity',
          'android:exported': 'false',
          'android:launchMode': 'singleTop',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:theme': '@style/Theme.FocusGuard.BlockingOverlay',
          'android:screenOrientation': 'portrait',
        },
      });
    } else {
      // If the overlay activity is already declared (e.g., from a previous prebuild),
      // REMOVE the harmful flags if present.
      const overlayActivity = application.activity.find(
        (activity) => activity.$?.['android:name'] === '.BlockingOverlayActivity',
      );
      if (overlayActivity && overlayActivity.$) {
        delete overlayActivity.$['android:taskAffinity'];
        delete overlayActivity.$['android:excludeFromRecents'];
        delete overlayActivity.$['android:noHistory'];
        delete overlayActivity.$['android:finishOnTaskLaunch'];
      }
    }
    return config;
  });
}

module.exports = function withFocusGuardNative(config) {
  return withServiceManifest(withNativeSources(config));
};
