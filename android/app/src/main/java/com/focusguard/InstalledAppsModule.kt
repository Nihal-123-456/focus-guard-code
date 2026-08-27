package com.focusguard

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
