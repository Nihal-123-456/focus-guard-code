/**
 * Scheduler service — runs in the JS layer while the app is foregrounded.
 *
 * On each tick (every 30s), it:
 * 1. Looks at all ENABLED schedules.
 * 2. For each schedule whose window just became active, starts a scheduled session.
 * 3. If the active session's owning schedule window has ended, ends the session
 *    (with reason 'schedule_window_ended' — does NOT count as aborted in stats).
 *
 * NOTE: This service only runs while the app is open or in the foreground.
 * For true background scheduling (when the app is closed), you'd need to add
 * a native WorkManager / AlarmManager job — see README § Known Limitations.
 */
import { AppState, AppStateStatus } from 'react-native';
import { useScheduleStore, isWindowActiveAt } from '../data/scheduleStore';
import { useTimerStore } from '../data/timerStore';
import { useSettingsStore } from '../data/settingsStore';

const TICK_INTERVAL_MS = 30 * 1000; // 30 seconds

let tickInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let isInitialized = false;

async function tick() {
  const settings = useSettingsStore.getState();
  if (!settings.schedulesAutoStart) return;

  const scheduleStore = useScheduleStore.getState();
  const timerStore = useTimerStore.getState();
  const now = Date.now();

  const activeSession = timerStore.activeSession;

  // Case 1: There's an active scheduled session — check if its window ended.
  if (activeSession && activeSession.source === 'schedule' && activeSession.scheduleId) {
    const owningSchedule = scheduleStore.getById(activeSession.scheduleId);
    if (owningSchedule && owningSchedule.enabled) {
      const stillActive = isWindowActiveAt(owningSchedule, now);
      if (!stillActive) {
        // Schedule window ended — complete the session normally.
        console.info('[scheduler] schedule window ended — completing session');
        await timerStore.endSessionEarly('schedule_window_ended');
      } else {
        // Still active — nothing to do, the timer tick handles countdown.
      }
    } else {
      // Owning schedule was disabled or deleted — end the session.
      console.info('[scheduler] owning schedule disabled/deleted — ending session');
      await timerStore.endSessionEarly('schedule_window_ended');
    }
    return;
  }

  // Case 2: There's an active MANUAL session — don't interrupt it.
  if (activeSession && activeSession.source === 'manual') {
    return;
  }

  // Case 3: No active session — check if any schedule should fire.
  const enabledSchedules = scheduleStore.getEnabled();
  for (const schedule of enabledSchedules) {
    if (isWindowActiveAt(schedule, now)) {
      try {
        console.info(`[scheduler] firing schedule "${schedule.name}"`);
        await timerStore.startSessionForSchedule(schedule);
        return; // Only one session at a time.
      } catch (e) {
        console.warn(`[scheduler] failed to start schedule "${schedule.name}":`, e);
      }
    }
  }
}

/** Initialize the scheduler — call once on app launch. */
export function initScheduler() {
  if (isInitialized) return;
  isInitialized = true;

  // Start ticking immediately.
  tick().catch((e) => console.warn('[scheduler] initial tick failed:', e));
  tickInterval = setInterval(() => {
    tick().catch((e) => console.warn('[scheduler] tick failed:', e));
  }, TICK_INTERVAL_MS);

  // Also tick when the app comes back to the foreground.
  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      tick().catch((e) => console.warn('[scheduler] foreground tick failed:', e));
    }
  });

  console.info('[scheduler] initialized — tick interval:', TICK_INTERVAL_MS, 'ms');
}

/** Stop the scheduler — call when the app is being torn down. */
export function teardownScheduler() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  isInitialized = false;
}
