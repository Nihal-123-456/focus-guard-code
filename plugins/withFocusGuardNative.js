const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const appBlockerModule = `package __PACKAGE__

import android.content.ComponentName
import android.content.Intent
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppBlockerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppBlocker"

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
            val enabledServices = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
            ).orEmpty()
            val serviceName = ComponentName(
                reactApplicationContext,
                AppBlockerAccessibilityService::class.java,
            ).flattenToString()
            promise.resolve(enabledServices.split(':').any { it.equals(serviceName, ignoreCase = true) })
        } catch (error: Exception) {
            promise.reject("ACCESSIBILITY_STATUS_ERROR", error)
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
import android.view.accessibility.AccessibilityEvent

class AppBlockerAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    override fun onInterrupt() = Unit
}
`;

const accessibilityConfig = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="false"
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
    const applicationPath = path.join(javaDirectory, 'MainApplication.kt');

    fs.mkdirSync(javaDirectory, { recursive: true });
    fs.mkdirSync(valuesDirectory, { recursive: true });
    fs.mkdirSync(xmlDirectory, { recursive: true });

    const sources = {
      'AppBlockerModule.kt': appBlockerModule,
      'AppBlockerPackage.kt': appBlockerPackage,
      'InstalledAppsModule.kt': installedAppsModule,
      'InstalledAppsPackage.kt': installedAppsPackage,
      'AppBlockerAccessibilityService.kt': accessibilityService,
    };
    for (const [filename, template] of Object.entries(sources)) {
      fs.writeFileSync(path.join(javaDirectory, filename), sourceFor(template, packageName));
    }
    fs.writeFileSync(path.join(xmlDirectory, 'accessibility_service_config.xml'), accessibilityConfig);

    const stringsPath = path.join(valuesDirectory, 'strings.xml');
    let strings = fs.existsSync(stringsPath)
      ? fs.readFileSync(stringsPath, 'utf8')
      : '<resources>\n</resources>\n';
    if (!strings.includes('name="accessibility_service_description"')) {
      strings = strings.replace('</resources>', '  <string name="accessibility_service_description">Allows FocusGuard to monitor app launches during focus sessions.</string>\n</resources>');
      fs.writeFileSync(stringsPath, strings);
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
    return config;
  });
}

module.exports = function withFocusGuardNative(config) {
  return withServiceManifest(withNativeSources(config));
};