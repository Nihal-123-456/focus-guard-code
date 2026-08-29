package com.focusguard

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
                Log.e(TAG, "❌ Failed to show overlay: ${e.message}", e)
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
                Log.e(TAG, "Failed to hide overlay: ${e.message}", e)
            }
        }
    }

    fun isShowing(): Boolean = overlayView != null
}
