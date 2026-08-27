/**
 * Stats calculation helpers — pure functions over HistoryEntry[].
 */
import type { HistoryEntry, AggregatedStats, StatsRange } from '../types';
import { MS_PER_DAY, MS_PER_HOUR } from './time';

/** Get the start of the day (00:00:00 local) for a given epoch ms. */
function startOfDay(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Filter entries within the given range. */
export function filterByRange(entries: HistoryEntry[], range: StatsRange): HistoryEntry[] {
  if (range === 'all') return entries;
  const days = range === '7d' ? 7 : 30;
  const cutoff = Date.now() - days * MS_PER_DAY;
  return entries.filter((e) => e.startedAt >= cutoff);
}

/** Check if a session should count as "completed" for stats purposes.
 *  A schedule that ended because its window closed counts as completed. */
export function isCompleted(e: HistoryEntry): boolean {
  if (e.status === 'completed') return true;
  if (e.status === 'aborted' && e.abortReason === 'schedule_window_ended') {
    return true;
  }
  return false;
}

/** Check if a session was ended early by the user (i.e. truly aborted). */
export function isAborted(e: HistoryEntry): boolean {
  return e.status === 'aborted' && e.abortReason !== 'schedule_window_ended';
}

/** Aggregate stats for a given range. */
export function aggregateStats(
  entries: HistoryEntry[],
  range: StatsRange,
): AggregatedStats {
  const filtered = filterByRange(entries, range);

  const totalMs = filtered.reduce((sum, e) => sum + e.actualDurationMs, 0);
  const sessionCount = filtered.length;
  const completedCount = filtered.filter(isCompleted).length;
  const abortedCount = filtered.filter(isAborted).length;
  const avgSessionMs = sessionCount > 0 ? totalMs / sessionCount : 0;
  const completionRate = sessionCount > 0 ? completedCount / sessionCount : 0;

  // Daily aggregation — N days back, oldest first.
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 30; // cap 'all' to 30 for the chart
  const daily: { date: number; ms: number; count: number }[] = [];
  const todayStart = startOfDay(Date.now());
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = todayStart - i * MS_PER_DAY;
    const dayEnd = dayStart + MS_PER_DAY;
    const dayEntries = filtered.filter(
      (e) => e.startedAt >= dayStart && e.startedAt < dayEnd,
    );
    daily.push({
      date: dayStart,
      ms: dayEntries.reduce((sum, e) => sum + e.actualDurationMs, 0),
      count: dayEntries.length,
    });
  }

  // Per-hour-of-day aggregation (when do sessions typically start?).
  const hourly: { hour: number; ms: number; count: number }[] = Array.from(
    { length: 24 },
    (_, hour) => ({ hour, ms: 0, count: 0 }),
  );
  for (const e of filtered) {
    const hour = new Date(e.startedAt).getHours();
    hourly[hour].ms += e.actualDurationMs;
    hourly[hour].count += 1;
  }

  // Per-app breakdown.
  const perAppMap = new Map<string, { count: number; ms: number }>();
  for (const e of filtered) {
    for (const pkg of e.blacklistSnapshot) {
      const existing = perAppMap.get(pkg) ?? { count: 0, ms: 0 };
      existing.count += 1;
      existing.ms += e.actualDurationMs;
      perAppMap.set(pkg, existing);
    }
  }
  const perApp = Array.from(perAppMap.entries())
    .map(([packageName, v]) => ({ packageName, count: v.count, ms: v.ms }))
    .sort((a, b) => b.count - a.count);

  // Streaks — consecutive days with ≥1 completed session.
  const { currentStreak, longestStreak } = computeStreaks(filtered);

  return {
    totalMs,
    sessionCount,
    completedCount,
    abortedCount,
    avgSessionMs,
    completionRate,
    daily,
    hourly,
    perApp,
    currentStreak,
    longestStreak,
  };
}

/** Compute current and longest streak of consecutive days with completed sessions. */
function computeStreaks(entries: HistoryEntry[]): {
  currentStreak: number;
  longestStreak: number;
} {
  // Collect set of "completed days" (epoch ms of day start).
  const completedDays = new Set<number>();
  for (const e of entries) {
    if (!isCompleted(e)) continue;
    completedDays.add(startOfDay(e.startedAt));
  }
  if (completedDays.size === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  // Current streak: walk backwards from today (or yesterday if today has no completed session).
  let currentStreak = 0;
  const todayStart = startOfDay(Date.now());
  let cursor = todayStart;
  // If today has no completed session, the streak may have ended yesterday — still count it.
  // But if today IS completed, start from today.
  if (!completedDays.has(cursor)) {
    cursor -= MS_PER_DAY;
  }
  while (completedDays.has(cursor)) {
    currentStreak++;
    cursor -= MS_PER_DAY;
  }

  // Longest streak: sort days ascending, find longest consecutive run.
  const sortedDays = Array.from(completedDays).sort((a, b) => a - b);
  let longestStreak = 0;
  let runLength = 0;
  let prevDay: number | null = null;
  for (const day of sortedDays) {
    if (prevDay !== null && day === prevDay + MS_PER_DAY) {
      runLength++;
    } else {
      runLength = 1;
    }
    if (runLength > longestStreak) longestStreak = runLength;
    prevDay = day;
  }

  return { currentStreak, longestStreak };
}

/** Format a streak count, e.g. "3 days", "1 day", "No streak yet". */
export function formatStreak(days: number): string {
  if (days === 0) return 'No streak yet';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Find the hour-of-day bucket label, e.g. "9 AM", "12 PM", "11 PM". */
export function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

/** Get a label for a daily bucket date — short weekday for 7d, day-of-month for 30d. */
export function formatDayLabel(date: number, range: StatsRange): string {
  const d = new Date(date);
  if (range === '7d') {
    return d.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0);
  }
  return d.getDate().toString();
}

/** Find the peak focus hour (hour-of-day with most total focus ms). */
export function peakFocusHour(hourly: { hour: number; ms: number }[]): number | null {
  let peakHour: number | null = null;
  let peakMs = 0;
  for (const h of hourly) {
    if (h.ms > peakMs) {
      peakMs = h.ms;
      peakHour = h.hour;
    }
  }
  return peakMs > 0 ? peakHour : null;
}
