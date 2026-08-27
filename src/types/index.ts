/**
 * Core type definitions for FocusGuard.
 */

/** A single installed app on the device. */
export interface InstalledApp {
  /** Android package name, e.g. "com.whatsapp" */
  packageName: string;
  /** Human-readable label, e.g. "WhatsApp" */
  label: string;
  /** Whether the app can be launched (has a launcher activity) */
  isLaunchable: boolean;
  /** Whether this is a system app */
  isSystem: boolean;
}

/** A blacklisted app — only the packageName is persisted, label resolved at runtime. */
export interface BlacklistEntry {
  packageName: string;
  /** When the app was added to the blacklist */
  addedAt: number;
  /** Whether the app should allow incoming calls to pass through. */
  allowCallPassthrough: boolean;
}

/** Source of a focus session — manual user action or a preset schedule. */
export type SessionSource = 'manual' | 'schedule';

/** A focus session — active or historical. */
export interface FocusSession {
  /** Unique ID (timestamp-based) */
  id: string;
  /** Session start time (epoch ms) */
  startedAt: number;
  /** Planned end time (epoch ms) */
  endTime: number;
  /** Snapshot of the blacklist at session start (frozen). */
  blacklistSnapshot: string[];
  /** Total planned duration in ms */
  plannedDurationMs: number;
  /** Actual duration in ms (== planned if completed normally). */
  actualDurationMs: number;
  /** Session status */
  status: 'active' | 'completed' | 'aborted';
  /** If aborted, why. */
  abortReason?: 'user_override' | 'system_error' | 'app_uninstalled' | 'schedule_window_ended';
  /** When the session ended (epoch ms) — for completed/aborted sessions */
  endedAt?: number;
  /** What started this session */
  source: SessionSource;
  /** If source === 'schedule', the ID of the schedule that fired it */
  scheduleId?: string;
  /** If source === 'schedule', the schedule name (denormalized for history display) */
  scheduleName?: string;
}

/** The active session state stored in AsyncStorage. */
export interface ActiveSessionState {
  session: FocusSession;
  /** Whether the user has acknowledged the hard-lock warning */
  hardLockAcknowledged: boolean;
}

/** History entry — same as session but always terminal. */
export type HistoryEntry = FocusSession;

/**
 * A preset schedule — a recurring block window.
 *
 * Examples:
 *  - "Morning focus" Mon-Fri 09:00–11:00
 *  - "Bedtime" Every day 22:00–07:00 (next day)
 */
export interface PresetSchedule {
  /** Unique ID */
  id: string;
  /** User-facing name */
  name: string;
  /** Days of week to fire on. 0 = Sunday, 1 = Monday, …, 6 = Saturday. */
  daysOfWeek: number[];
  /** Start hour 0-23 */
  startHour: number;
  /** Start minute 0-59 (typically 0 or 30) */
  startMinute: number;
  /** End hour 0-23 */
  endHour: number;
  /** End minute 0-59 */
  endMinute: number;
  /** Whether this schedule is currently enabled */
  enabled: boolean;
  /**
   * Packages to block during this schedule's window.
   * If empty, falls back to the current main blacklist at fire time.
   */
  blacklist: string[];
  /** When the schedule was created (epoch ms) */
  createdAt: number;
  /** When the schedule was last modified */
  updatedAt: number;
}

/** A computed view of a schedule's next fire time, for UI display. */
export interface ScheduleNextFire {
  /** The schedule ID */
  scheduleId: string;
  /** Epoch ms when the schedule will next fire (null if no days selected) */
  nextFireAt: number | null;
  /** Whether the schedule's window is currently active right now */
  isCurrentlyActive: boolean;
  /** Current session ID if the schedule fired and is currently running */
  activeSessionId?: string;
}

/** App settings. */
export interface AppSettings {
  /** Whether to show system apps in the list */
  showSystemApps: boolean;
  /** Whether to allow call passthrough for communication apps */
  callPassthroughEnabled: boolean;
  /** Whether to show the "dangerous mode" warning (anti-uninstall soft) */
  dangerousModeEnabled: boolean;
  /** Default session duration in minutes */
  defaultDurationMin: number;
  /** Whether scheduled sessions should auto-start when their window opens */
  schedulesAutoStart: boolean;
}

/** Default app settings */
export const DEFAULT_SETTINGS: AppSettings = {
  showSystemApps: false,
  callPassthroughEnabled: true,
  dangerousModeEnabled: false,
  defaultDurationMin: 60,
  schedulesAutoStart: true,
};

/** Stats range for filtering. */
export type StatsRange = '7d' | '30d' | 'all';

/** Aggregated stats for a given range. */
export interface AggregatedStats {
  totalMs: number;
  sessionCount: number;
  completedCount: number;
  abortedCount: number;
  avgSessionMs: number;
  completionRate: number; // 0-1
  /** Per-day totals for charting, oldest first. */
  daily: { date: number; ms: number; count: number }[];
  /** Per-hour-of-day totals (0-23). */
  hourly: { hour: number; ms: number; count: number }[];
  /** Per-app blocked totals, sorted descending. */
  perApp: { packageName: string; count: number; ms: number }[];
  /** Current streak (consecutive days with at least one completed session) */
  currentStreak: number;
  /** Longest streak ever */
  longestStreak: number;
}

/** Native bridge responses */
export interface NativeInstalledAppsResponse {
  apps: InstalledApp[];
}

export interface NativeBlockerStatus {
  isAccessibilityEnabled: boolean;
  isBlockingActive: boolean;
  blockedPackage?: string | null;
  lastBlockedAt?: number | null;
}
