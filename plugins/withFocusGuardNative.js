const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const appBlockerModule = `package __PACKAGE__

import android.content.ComponentName
import android.content.Intent
import android.content.SharedPreferences
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
    }

    private fun clearBlockingState() {
        prefs().edit()
            .putBoolean(KEY_BLOCKING_ACTIVE, false)
            .putStringSet(KEY_BLOCKED_PACKAGES, mutableSetOf())
            .remove(KEY_LAST_BLOCKED_PACKAGE)
            .remove(KEY_LAST_BLOCKED_AT)
            .apply()
    }

    private fun buildStatus(): WritableMap {
        val storedPrefs = prefs()
        val status = Arguments.createMap()
        status.putBoolean("isAccessibilityEnabled", isAccessibilityServiceEnabled())
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
import android.content.Intent
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

    private fun currentForegroundPackage(): String =
        rootInActiveWindow?.packageName?.toString().orEmpty()

    private fun startWatchdog() {
        watchdogHandler.removeCallbacks(watchdogRunnable)
        watchdogHandler.postDelayed(watchdogRunnable, WATCHDOG_INTERVAL_MS)
    }

    private fun stopWatchdog() {
        watchdogHandler.removeCallbacks(watchdogRunnable)
    }

    private fun maybeEnforceForegroundPackage(targetPackage: String) {
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

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val targetPackage = event?.packageName?.toString().orEmpty()
            .ifBlank { currentForegroundPackage() }
        maybeEnforceForegroundPackage(targetPackage)
    }

    override fun onDestroy() {
        stopWatchdog()
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
            blockedLabel.isNotBlank() && packageName.isNotBlank() -> "$blockedLabel ($packageName)"
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

    application.activity = application.activity || [];
    const overlayAlreadyDeclared = application.activity.some(
      (activity) => activity.$?.['android:name'] === '.BlockingOverlayActivity',
    );
    if (!overlayAlreadyDeclared) {
      application.activity.push({
        $: {
          'android:name': '.BlockingOverlayActivity',
          'android:exported': 'false',
          'android:excludeFromRecents': 'true',
          'android:finishOnTaskLaunch': 'true',
          'android:launchMode': 'singleTop',
          'android:noHistory': 'true',
          'android:showWhenLocked': 'true',
          'android:turnScreenOn': 'true',
          'android:theme': '@style/Theme.FocusGuard.BlockingOverlay',
          'android:taskAffinity': '',
          'android:screenOrientation': 'portrait',
        },
      });
    }
    return config;
  });
}

module.exports = function withFocusGuardNative(config) {
  return withServiceManifest(withNativeSources(config));
};
