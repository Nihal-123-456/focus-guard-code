package com.focusguard

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_blocking_overlay)

        val packageName = intent.getStringExtra(EXTRA_BLOCKED_PACKAGE).orEmpty()
        val blockedLabel = intent.getStringExtra(EXTRA_BLOCKED_LABEL).orEmpty()

        findViewById<TextView>(R.id.blockingPackage).text = when {
            blockedLabel.isNotBlank() && packageName.isNotBlank() -> "$blockedLabel ($packageName)"
            blockedLabel.isNotBlank() -> blockedLabel
            packageName.isNotBlank() -> packageName
            else -> getString(R.string.app_name)
        }
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
        val packageName = intent?.getStringExtra(EXTRA_BLOCKED_PACKAGE).orEmpty()
        val blockedLabel = intent?.getStringExtra(EXTRA_BLOCKED_LABEL).orEmpty()
        findViewById<TextView>(R.id.blockingPackage).text = when {
            blockedLabel.isNotBlank() && packageName.isNotBlank() -> "$blockedLabel ($packageName)"
            blockedLabel.isNotBlank() -> blockedLabel
            packageName.isNotBlank() -> packageName
            else -> getString(R.string.app_name)
        }
    }
}
