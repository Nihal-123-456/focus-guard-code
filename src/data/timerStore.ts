import { create } from 'zustand';
import type { FocusSession, ActiveSessionState, PresetSchedule } from '../types';
import { readJSON, writeJSON, remove, StorageKeys } from './storage';
import { useBlacklistStore } from './blacklistStore';
import { useHistoryStore } from './historyStore';
import { MS_PER_MINUTE } from '../utils/time';
import { AppBlocker } from '../native/AppBlocker';
import { computeWindowEnd } from './scheduleStore';

interface TimerState {
  activeSession: FocusSession | null;
  hardLockAcknowledged: boolean;
  remainingMs: number;
  loaded: boolean;
  /** Internal tick interval ID */
  _tickInterval: ReturnType<typeof setInterval> | null;

  /** Hydrate from AsyncStorage. If a session is active, resumes the countdown. */
  hydrate: () => Promise<void>;

  /** Start a new manual focus session. */
  startSession: (durationMinutes: number) => Promise<FocusSession>;

  /**
   * Start a scheduled focus session for the given preset schedule.
   * The end time is computed from the schedule's window (startHour:startMinute
   * → endHour:endMinute, accounting for overnight windows).
   * The schedule's blacklist takes precedence; falls back to the main blacklist
   * if the schedule's blacklist is empty.
   */
  startSessionForSchedule: (schedule: PresetSchedule) => Promise<FocusSession>;

  /** End the session early — usually disallowed by UI, but exposed for emergencies. */
  endSessionEarly: (reason?: 'user_override' | 'system_error' | 'schedule_window_ended') => Promise<void>;
  /** Mark session as completed when timer hits zero. */
  completeSession: () => Promise<void>;

  /** Get the current remaining ms. */
  getRemaining: () => number;

  /** Start / stop the internal tick. */
  startTick: () => void;
  stopTick: () => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  activeSession: null,
  hardLockAcknowledged: false,
  remainingMs: 0,
  loaded: false,
  _tickInterval: null,

  async hydrate() {
    const state = await readJSON<ActiveSessionState | null>(StorageKeys.ACTIVE_SESSION, null);
    if (state && state.session.status === 'active') {
      const remaining = state.session.endTime - Date.now();
      if (remaining <= 0) {
        // Session should have ended while app was closed — finalize it.
        await useTimerStore.getState().completeSession();
      } else {
        // Activate blocking on the native side too.
        useBlacklistStore.getState().freezeSnapshot();
        try {
          await AppBlocker.activateBlocking(state.session.blacklistSnapshot);
        } catch (e) {
          console.warn('[timer] failed to reactivate blocking on hydrate:', e);
        }
        set({
          activeSession: state.session,
          hardLockAcknowledged: state.hardLockAcknowledged,
          remainingMs: remaining,
          loaded: true,
        });
        get().startTick();
      }
    } else {
      set({ loaded: true });
    }
  },

  async startSession(durationMinutes) {
    if (get().activeSession !== null) {
      throw new Error('A session is already active.');
    }

    const now = Date.now();
    const durationMs = durationMinutes * MS_PER_MINUTE;
    const blacklistPackages = useBlacklistStore
      .getState()
      .getBlacklistedPackages();

    if (blacklistPackages.length === 0) {
      throw new Error('Add at least one app to the blacklist first.');
    }

    const session: FocusSession = {
      id: `session_${now}`,
      startedAt: now,
      endTime: now + durationMs,
      blacklistSnapshot: blacklistPackages,
      plannedDurationMs: durationMs,
      actualDurationMs: durationMs,
      status: 'active',
      source: 'manual',
    };

    // Freeze blacklist snapshot so it can't be edited mid-session.
    useBlacklistStore.getState().freezeSnapshot();

    // Activate native blocking.
    await AppBlocker.activateBlocking(blacklistPackages);

    const state: ActiveSessionState = {
      session,
      hardLockAcknowledged: false,
    };
    await writeJSON(StorageKeys.ACTIVE_SESSION, state);

    set({
      activeSession: session,
      hardLockAcknowledged: false,
      remainingMs: durationMs,
      loaded: true,
    });
    get().startTick();
    return session;
  },

  async startSessionForSchedule(schedule) {
    if (get().activeSession !== null) {
      throw new Error('A session is already active.');
    }

    const now = Date.now();
    const endTime = computeWindowEnd(schedule, now);
    const durationMs = Math.max(60 * 1000, endTime - now); // min 1 min

    // Schedule blacklist takes precedence; fall back to main blacklist.
    const blacklistPackages = schedule.blacklist.length > 0
      ? schedule.blacklist
      : useBlacklistStore.getState().getBlacklistedPackages();

    if (blacklistPackages.length === 0) {
      throw new Error('Schedule has no apps to block and main blacklist is empty.');
    }

    const session: FocusSession = {
      id: `session_${now}_sched_${schedule.id}`,
      startedAt: now,
      endTime,
      blacklistSnapshot: blacklistPackages,
      plannedDurationMs: durationMs,
      actualDurationMs: durationMs,
      status: 'active',
      source: 'schedule',
      scheduleId: schedule.id,
      scheduleName: schedule.name,
    };

    // Freeze blacklist snapshot.
    useBlacklistStore.getState().freezeSnapshot();

    // Activate native blocking.
    await AppBlocker.activateBlocking(blacklistPackages);

    const state: ActiveSessionState = {
      session,
      hardLockAcknowledged: false,
    };
    await writeJSON(StorageKeys.ACTIVE_SESSION, state);

    set({
      activeSession: session,
      hardLockAcknowledged: false,
      remainingMs: durationMs,
      loaded: true,
    });
    get().startTick();
    return session;
  },

  async endSessionEarly(reason = 'user_override') {
    const session = get().activeSession;
    if (!session) return;
    get().stopTick();

    const elapsed = Date.now() - session.startedAt;
    const finalized: FocusSession = {
      ...session,
      status: 'aborted',
      abortReason: reason,
      actualDurationMs: elapsed,
      endedAt: Date.now(),
    };

    // Deactivate native blocking.
    await AppBlocker.deactivateBlocking();
    useBlacklistStore.getState().clearSnapshot();

    // Move to history.
    await useHistoryStore.getState().addEntry(finalized);
    await remove(StorageKeys.ACTIVE_SESSION);

    set({
      activeSession: null,
      hardLockAcknowledged: false,
      remainingMs: 0,
    });
  },

  async completeSession() {
    const session = get().activeSession;
    if (!session) return;
    get().stopTick();

    const finalized: FocusSession = {
      ...session,
      status: 'completed',
      actualDurationMs: session.plannedDurationMs,
      endedAt: Date.now(),
    };

    await AppBlocker.deactivateBlocking();
    useBlacklistStore.getState().clearSnapshot();
    await useHistoryStore.getState().addEntry(finalized);
    await remove(StorageKeys.ACTIVE_SESSION);

    set({
      activeSession: null,
      hardLockAcknowledged: false,
      remainingMs: 0,
    });
  },

  getRemaining() {
    const session = get().activeSession;
    if (!session) return 0;
    return Math.max(0, session.endTime - Date.now());
  },

  startTick() {
    if (get()._tickInterval) return;
    const interval = setInterval(() => {
      const session = get().activeSession;
      if (!session) {
        get().stopTick();
        return;
      }
      const remaining = Math.max(0, session.endTime - Date.now());
      set({ remainingMs: remaining });
      if (remaining <= 0) {
        // Auto-complete the session.
        get().completeSession().catch((e) => {
          console.warn('[timer] failed to complete session:', e);
        });
      }
    }, 1000);
    set({ _tickInterval: interval });
  },

  stopTick() {
    const interval = get()._tickInterval;
    if (interval) {
      clearInterval(interval);
      set({ _tickInterval: null });
    }
  },
}));
