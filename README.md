# FocusGuard — Digital Detox App Blocker

A React Native app that helps users refrain from unnecessary phone use by:
- Listing all installed apps on the device
- Letting the user blacklist distracting apps
- Setting "focus sessions" (timers) during which blacklisted apps are blocked
- Hard-locking the timer so it cannot be stopped and the blacklist cannot be edited mid-session
- Allowing incoming calls to pass through (Phone, WhatsApp, imo, Messenger)

> **Platform:** Android only (iOS does not support listing installed apps).
> **Architecture:** Expo + RN CLI hybrid (dev build required for native modules).
> **Backend:** Fully offline (AsyncStorage).

---

## ⚠️ Important Notes

This app uses Android's **AccessibilityService** to intercept and block app launches during a focus session. This is the same mechanism used by AppBlock, StayFocusd, and similar apps. It requires the user to manually grant the Accessibility permission.

During an active focus session, the app enforces:
1. ❌ Timer cannot be stopped or paused
2. ❌ Blacklist cannot be edited (no removing apps)
3. ❌ AccessibilityService cannot be disabled (app re-prompts to re-enable)
4. ✅ Incoming calls (Phone / WhatsApp / imo / Messenger) are allowed to ring and be answered

---

## Project Structure

```
focusguard/
├── App.tsx                      # Entry point, providers, navigation, scheduler init
├── app.json                     # Expo config
├── package.json
├── tsconfig.json
├── babel.config.js
├── README.md
│
├── src/
│   ├── theme/
│   │   ├── colors.ts            # Minimalist zen palette
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── index.ts
│   │
│   ├── types/
│   │   └── index.ts             # All TypeScript types (incl. PresetSchedule, AggregatedStats)
│   │
│   ├── data/
│   │   ├── storage.ts           # AsyncStorage wrapper with namespacing
│   │   ├── blacklistStore.ts    # Blacklist state + persistence
│   │   ├── timerStore.ts        # Active timer state + countdown + scheduled sessions
│   │   ├── historyStore.ts      # Past session history
│   │   ├── scheduleStore.ts     # CRUD + day/time computation for preset schedules
│   │   ├── settingsStore.ts     # App settings (incl. schedulesAutoStart)
│   │   └── appListStore.ts      # Cached installed app list
│   │
│   ├── services/
│   │   └── scheduler.ts         # 30s tick — auto-fires/enables scheduled sessions
│   │
│   ├── native/
│   │   ├── InstalledApps.ts     # TS wrapper around native module
│   │   └── AppBlocker.ts        # TS wrapper around AccessibilityService bridge
│   │
│   ├── components/
│   │   ├── AppCard.tsx          # Single app row in list
│   │   ├── TimerPill.tsx        # Small timer display
│   │   ├── DurationPicker.tsx   # Preset + custom duration
│   │   ├── EmptyState.tsx
│   │   ├── PermissionCard.tsx   # Accessibility permission prompt
│   │   ├── StatCard.tsx
│   │   ├── BarChart.tsx         # Vertical bar chart (pure RN, no SVG)
│   │   ├── StreakBadge.tsx      # Current/longest streak indicator
│   │   ├── WeekdayPicker.tsx    # Day-of-week toggle selector
│   │   ├── TimeRangePicker.tsx  # Start/end time picker with modal
│   │   └── ScheduleCard.tsx     # Schedule row in list
│   │
│   ├── screens/
│   │   ├── HomeScreen.tsx       # Dashboard + next-schedule card + quick start
│   │   ├── AppListScreen.tsx    # Installed apps + blacklist toggle
│   │   ├── TimerSetupScreen.tsx # Choose duration
│   │   ├── ActiveTimerScreen.tsx # Hard-locked active session
│   │   ├── StatsScreen.tsx      # Charts, streaks, per-app breakdown
│   │   ├── HistoryScreen.tsx    # Full chronological session list
│   │   ├── SchedulesScreen.tsx  # List of schedules + create button
│   │   ├── ScheduleEditorScreen.tsx # Create/edit a schedule
│   │   └── SettingsScreen.tsx   # Permissions, schedules auto-start, etc.
│   │
│   ├── navigation/
│   │   └── AppNavigator.tsx     # Stack + Tab navigation
│   │
│   └── utils/
│       ├── time.ts              # Duration + relative time formatting
│       ├── stats.ts             # Aggregation, streaks, per-app breakdown
│       └── constants.ts         # Call-passthrough app packages
│
└── android/                     # Native Android modules (see README § Native Setup)
    ├── app/src/main/
    │   ├── AndroidManifest.xml
    │   └── java/com/focusguard/
    │       ├── MainApplication.kt
    │       ├── InstalledAppsModule.kt
    │       ├── InstalledAppsPackage.kt
    │       ├── AppBlockerAccessibilityService.kt
    │       ├── AppBlockerModule.kt
    │       └── AppBlockerPackage.kt
    └── app/src/main/res/xml/
        └── accessibility_service_config.xml
```

---

## Setup & Run

### Prerequisites
- Node 18+
- Android Studio (with Android SDK 33+)
- An Android device or emulator (API 24+)

### Install JS dependencies
```bash
cd focusguard
npm install
```

### Run as Expo dev build (recommended)

The native modules need to be compiled into a dev client. Use Expo's prebuild:

```bash
# Generate native Android project from app.json
npx expo prebuild --platform android

# Build and install the dev client on a connected device
npx expo run:android
```

> ⚠️ This is NOT a managed Expo Go project — Expo Go cannot load native modules. You must use `expo run:android` or build a dev client via EAS.

### Run as bare RN CLI project (alternative)

If you prefer pure RN CLI:
```bash
npx react-native run-android
```

### Grant the Accessibility permission (mandatory)

After installing the app on a device:
1. Open **Settings → Accessibility → FocusGuard**
2. Toggle the service ON
3. Confirm the prompt

The app will not be able to block apps until this is granted. The Home screen shows a permission card if it's missing.

---

## How It Works

### App blocking flow
1. User opens app → sees Home dashboard
2. User goes to App List → native `InstalledAppsModule` queries `PackageManager` for all launchable apps
3. User toggles blacklist on distracting apps → persisted to AsyncStorage
4. User starts a focus session (Timer Setup screen) with a duration (e.g. 10h)
5. `timerStore` writes `activeSession = { endTime, blacklistSnapshot }` to storage and broadcasts to native via `AppBlockerModule.activateBlocking()`
6. `AppBlockerAccessibilityService` receives the active blacklist and starts intercepting `AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED`
7. If the foreground package matches a blacklisted app, the service launches FocusGuard's main activity over it
8. When `endTime` is reached, `timerStore` clears the active session and calls `AppBlockerModule.deactivateBlocking()`

### Call passthrough
The accessibility service inspects `event.packageName`. Communication apps (Phone, WhatsApp, imo, Messenger) are blacklisted at the launcher level, but when an incoming call arrives, the system shows the call UI directly (not via the launcher), and the service recognizes the call-state event and lets it through.

Implementation detail: the service checks `KeyguardManager` / `TelecomManager` for in-call state; if a call is active, blocking is temporarily suspended for that single app.

### Hard-lock enforcement
During an active session:
- The Active Timer screen has NO stop/pause button — only "End early" with a 10-second cancel cooldown AND a confirm dialog
- The App List screen hides the "Remove from blacklist" toggle (replaced with a lock icon)
- The accessibility service polls `timerStore.getActiveSession()` every 5 seconds; if the user tries to disable the accessibility service, the service re-launches FocusGuard's main activity to re-prompt

> Anti-uninstall during a session requires Device Owner mode (not in MVP). For now, the app warns the user that uninstalling requires the session to end first (soft warning only).

---

## Roadmap

| Status | Feature |
|--------|---------|
| ✅ v1.0 | Installed app list, blacklist, timer, hard-lock, call passthrough |
| ✅ v1.1 | Preset schedules — recurring blocks (weekday mornings, bedtime, etc.) with overnight windows |
| ✅ v1.2 | Stats screen — daily/30-day charts, time-of-day pattern, per-app breakdown, streaks, completion rate |
| ✅ v1.2 | Full session history with filters (all / completed / ended early) and per-session app breakdown |
| 🔜 v1.3 | Background scheduling via native WorkManager (schedules currently only fire while app is open) |
| 🔜 v1.4 | Anti-uninstall via Device Owner |
| 🔜 v1.5 | Optional cloud sync |

---

## Stats & History

The **Stats** tab shows:

- **Top-line stats**: total focus time, average per session, completed vs. ended early counts.
- **Streak badge**: current consecutive-day streak of completed sessions, plus your all-time longest streak.
- **Completion rate**: percentage of sessions you completed (vs. ended early). Sessions that ended because their schedule window closed count as completed.
- **Peak focus hour**: the hour of day you most often start focus sessions.
- **Daily focus chart**: vertical bar chart of focus time per day for the last 7 or 30 days. Tap the range buttons at the top to switch.
- **Time-of-day pattern**: bar chart showing which hours of the day you tend to focus most.
- **Most-blocked apps**: per-app breakdown with horizontal bars showing how often each app was in a session's blacklist.
- **Recent sessions**: 5 most recent sessions with quick info, plus a "See all →" link to the full History screen.

The **History** screen (accessible from Stats → See all) shows the full chronological list with filters: All / Completed / Ended early. Each session card shows duration, start/end times, source (Manual vs. Schedule), and the list of apps that were blocked.

---

## Preset Schedules

Schedules let you set up **recurring block windows** — e.g. "Weekday mornings 9–11 AM" or "Bedtime every day 10 PM – 7 AM". When a schedule's window opens, FocusGuard automatically starts a focus session (if no other session is active and auto-start is enabled in Settings). When the window closes, the session ends automatically and counts as completed.

### Creating a schedule
1. Go to the **Schedules** tab.
2. Tap **+ New schedule**.
3. Pick a quick template (Weekday mornings, Bedtime, Weekend mornings, All day) or set up manually.
4. Enter a name.
5. Pick the days of week.
6. Set the start and end times — overnight windows (end time earlier than start time) are supported.
7. Choose whether to use a custom blacklist (specific to this schedule) or fall back to your main blacklist.
8. Save.

### Schedule behavior
- **Auto-start**: controlled by a setting in the Settings tab. When disabled, schedules appear in the list but don't fire automatically (useful for planning ahead).
- **One session at a time**: if a manual session is already running when a schedule's window opens, the schedule is skipped.
- **Window end = session end**: when the schedule's window closes, the active session ends with status `schedule_window_ended` — which counts as "completed" for stats/streak purposes, not "ended early".
- **Overnight windows**: e.g. 22:00 → 07:00 means the session starts at 10 PM and ends at 7 AM the next day. The day-of-week you select refers to the day the window *starts*.
- **Disabling a running schedule**: if you toggle off a schedule that's currently running, FocusGuard will ask whether to end the active session immediately.

### Scheduler service limitations
The scheduler runs in the JavaScript layer and ticks every 30 seconds **while the app is open** (or just brought to the foreground). For schedules to fire when the app is fully closed, you'd need to add a native Android `WorkManager` job — this is on the roadmap for v1.3.

---

## Known Limitations

- **iOS unsupported** — Apple's sandboxing prevents enumerating installed apps. A separate iOS build using Family Controls / Screen Time API would be required.
- **Background scheduling** — scheduled sessions only auto-fire while FocusGuard is open or in the foreground. For true background firing, a native `WorkManager` job is needed (v1.3 roadmap).
- **Anti-uninstall is soft** — without Device Owner mode, a determined user can still uninstall the app mid-session. To enable true anti-uninstall, set up Device Owner via ADB (`adb shell dpm set-device-owner com.focusguard/.DeviceAdminReceiver`).
- **App detection lag** — the accessibility service fires on window-state changes; a blacklisted app may flash briefly before being blocked (typically <200ms).
- **Battery** — the accessibility service runs continuously during a session; expected ~2-4% battery drain per hour.

---

## License

MIT
