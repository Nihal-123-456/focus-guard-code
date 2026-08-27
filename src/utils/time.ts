/** Time / duration helpers. */

export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Format a duration in ms as "H:MM:SS" or "MM:SS" if under 1 hour. */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

/** Format a duration in ms as a human-readable string, e.g. "2 hours 30 min" or "15 min". */
export function formatDurationHuman(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMinutes = Math.round(ms / MS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ${minutes} min`;
  }
  if (hours > 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${minutes} min`;
}

/** Format remaining time for the timer display: "2h 15m" or "3m 20s" or "45s". */
export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  const totalSeconds = Math.floor(ms / MS_PER_SECOND);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Convert minutes → ms */
export function minutesToMs(minutes: number): number {
  return minutes * MS_PER_MINUTE;
}

/** Convert hours → ms */
export function hoursToMs(hours: number): number {
  return hours * MS_PER_HOUR;
}

/** Format an ISO date for display, e.g. "Aug 25, 14:30". */
export function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format a short time, e.g. "14:30". */
export function formatTime(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Get current epoch ms. */
export function now(): number {
  return Date.now();
}

/**
 * Format a future timestamp as a relative duration until it fires.
 * Examples: "in 5 min", "in 2 hours", "in 3 days", "tomorrow 14:30".
 */
export function formatRelativeUntil(targetMs: number, fromMs: number = Date.now()): string {
  const delta = targetMs - fromMs;
  if (delta <= 0) return 'now';

  const minutes = Math.floor(delta / MS_PER_MINUTE);
  const hours = Math.floor(delta / MS_PER_HOUR);
  const days = Math.floor(delta / MS_PER_DAY);

  if (minutes < 1) return 'in <1 min';
  if (minutes < 60) return `in ${minutes} min`;
  if (hours < 24) {
    const remMin = Math.round((delta - hours * MS_PER_HOUR) / MS_PER_MINUTE);
    return remMin > 0 ? `in ${hours}h ${remMin}m` : `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  if (days === 1) {
    // Tomorrow at HH:MM
    return `tomorrow ${formatTime(targetMs)}`;
  }
  if (days < 7) {
    return `in ${days} days · ${formatTime(targetMs)}`;
  }
  return formatDateTime(targetMs);
}

