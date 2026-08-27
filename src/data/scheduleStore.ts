import { create } from 'zustand';
import type { PresetSchedule, ScheduleNextFire } from '../types';
import { readJSON, writeJSON, StorageKeys } from './storage';

interface ScheduleState {
  schedules: PresetSchedule[];
  loaded: boolean;

  hydrate: () => Promise<void>;
  persist: () => Promise<void>;

  add: (input: Omit<PresetSchedule, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PresetSchedule>;
  update: (id: string, patch: Partial<Omit<PresetSchedule, 'id' | 'createdAt'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggle: (id: string) => Promise<void>;

  getById: (id: string) => PresetSchedule | undefined;
  /** All enabled schedules. */
  getEnabled: () => PresetSchedule[];
  /** Compute the next fire time for a schedule, or null if no valid day. */
  getNextFire: (schedule: PresetSchedule, fromMs?: number) => number | null;
  /** Compute next-fire info for ALL enabled schedules (for UI listing). */
  getAllNextFire: (fromMs?: number) => ScheduleNextFire[];
  /** Check if a schedule's window is currently active right now. */
  isWindowActive: (schedule: PresetSchedule, atMs?: number) => boolean;
  /** Get the schedule that owns the current active session (if any). */
  getActiveSchedule: () => PresetSchedule | null;
}

/** Days of week labels (Sunday-first to match JS Date.getDay()). */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Convert {hour, minute} to ms-since-midnight for comparison. */
function timeToMs(hour: number, minute: number): number {
  return hour * 60 * 60 * 1000 + minute * 60 * 1000;
}

/** Get the time-of-day (ms since midnight) for a given epoch ms. */
function timeOfDayMs(epochMs: number): number {
  const d = new Date(epochMs);
  return d.getHours() * 60 * 60 * 1000 + d.getMinutes() * 60 * 1000;
}

/** Get the day-of-week (0=Sun, 6=Sat) for a given epoch ms in local time. */
function dayOfWeek(epochMs: number): number {
  return new Date(epochMs).getDay();
}

/** Compute the next fire time for a schedule. */
export function computeNextFire(
  schedule: PresetSchedule,
  fromMs: number = Date.now(),
): number | null {
  if (schedule.daysOfWeek.length === 0) return null;

  const startMs = timeToMs(schedule.startHour, schedule.startMinute);
  const now = new Date(fromMs);

  // Try each of the next 8 days (allows wrap-around past Sunday).
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(0, 0, 0, 0);

    const dow = candidate.getDay();
    if (!schedule.daysOfWeek.includes(dow)) continue;

    // Compute fire time on this day.
    const fireMs = candidate.getTime() + startMs;

    // If today and the start time has already passed, skip (we'll catch tomorrow's window).
    if (offset === 0 && fireMs <= fromMs) {
      // But if the schedule's window is currently active, we report NOW as next fire.
      if (isWindowActiveAt(schedule, fromMs)) {
        return fromMs;
      }
      continue;
    }

    return fireMs;
  }

  return null;
}

/** Check if the schedule's window is currently active at the given time. */
export function isWindowActiveAt(
  schedule: PresetSchedule,
  atMs: number = Date.now(),
): boolean {
  if (schedule.daysOfWeek.length === 0) return false;

  const dow = dayOfWeek(atMs);
  if (!schedule.daysOfWeek.includes(dow)) return false;

  const startMs = timeToMs(schedule.startHour, schedule.startMinute);
  const endMs = timeToMs(schedule.endHour, schedule.endMinute);
  const todayMs = timeOfDayMs(atMs);

  if (endMs > startMs) {
    // Same-day window (e.g. 09:00–11:00).
    return todayMs >= startMs && todayMs < endMs;
  }

  // Overnight window (e.g. 22:00–07:00 next day).
  // Active if todayMs >= startMs (past start) OR todayMs < endMs (before end).
  // For overnight, we also need to check if yesterday's window is still running.
  // But we also need to verify yesterday's day-of-week matches.
  if (endMs <= startMs) {
    if (todayMs >= startMs) {
      // Window started today — check today's day-of-week (already done above).
      return true;
    }
    if (todayMs < endMs) {
      // Window started yesterday — verify yesterday was a scheduled day.
      const yesterday = new Date(atMs);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDow = yesterday.getDay();
      return schedule.daysOfWeek.includes(yesterdayDow);
    }
  }

  return false;
}

/** Compute the end time (epoch ms) for a schedule window that contains `atMs`. */
export function computeWindowEnd(
  schedule: PresetSchedule,
  atMs: number = Date.now(),
): number {
  const startMs = timeToMs(schedule.startHour, schedule.startMinute);
  const endMs = timeToMs(schedule.endHour, schedule.endMinute);
  const today = new Date(atMs);
  today.setHours(0, 0, 0, 0);

  if (endMs > startMs) {
    // Same-day window.
    return today.getTime() + endMs;
  }

  // Overnight window: end is tomorrow at endMs.
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getTime() + endMs;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  loaded: false,

  async hydrate() {
    const schedules = await readJSON<PresetSchedule[]>(StorageKeys.SCHEDULES, []);
    set({ schedules, loaded: true });
  },

  async persist() {
    await writeJSON(StorageKeys.SCHEDULES, get().schedules);
  },

  async add(input) {
    const now = Date.now();
    const schedule: PresetSchedule = {
      ...input,
      id: `sched_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...get().schedules, schedule];
    set({ schedules: next });
    await get().persist();
    return schedule;
  },

  async update(id, patch) {
    const next = get().schedules.map((s) =>
      s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s,
    );
    set({ schedules: next });
    await get().persist();
  },

  async remove(id) {
    const next = get().schedules.filter((s) => s.id !== id);
    set({ schedules: next });
    await get().persist();
  },

  async toggle(id) {
    const schedule = get().schedules.find((s) => s.id === id);
    if (!schedule) return;
    await get().update(id, { enabled: !schedule.enabled });
  },

  getById(id) {
    return get().schedules.find((s) => s.id === id);
  },

  getEnabled() {
    return get().schedules.filter((s) => s.enabled);
  },

  getNextFire(schedule, fromMs) {
    return computeNextFire(schedule, fromMs);
  },

  getAllNextFire(fromMs) {
    return get()
      .getEnabled()
      .map((s) => ({
        scheduleId: s.id,
        nextFireAt: computeNextFire(s, fromMs),
        isCurrentlyActive: isWindowActiveAt(s, fromMs),
      }))
      .sort((a, b) => {
        // Active sessions first, then by nextFireAt asc, nulls last.
        if (a.isCurrentlyActive && !b.isCurrentlyActive) return -1;
        if (!a.isCurrentlyActive && b.isCurrentlyActive) return 1;
        if (a.nextFireAt === null) return 1;
        if (b.nextFireAt === null) return -1;
        return a.nextFireAt - b.nextFireAt;
      });
  },

  isWindowActive(schedule, atMs) {
    return isWindowActiveAt(schedule, atMs);
  },

  getActiveSchedule() {
    // Re-import here to avoid circular import at module load time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useTimerStore } = require('./timerStore');
    const activeSession = useTimerStore.getState().activeSession;
    if (!activeSession || activeSession.source !== 'schedule') return null;
    return get().schedules.find((s) => s.id === activeSession.scheduleId) ?? null;
  },
}));
