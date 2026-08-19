import { strings } from '@/strings/pt-BR';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A stretch of tracked work, written the way the productivity card asks for it:
 * "2h 15min".
 *
 * Two units at most, and never a unit that would read as zero. A task that took
 * three days is "3d 4h" rather than "3d 4h 12min" — the minutes are noise beside
 * the days — and one that took ninety minutes is "1h 30min" rather than "90min".
 * A whole number of hours drops the minutes entirely, so the common case is "2h"
 * and not "2h 0min".
 *
 * Anything under a minute is written as such rather than rounded to "0min": a
 * task moved to "Em andamento" and finished in the same breath did take *some*
 * time, and a zero says the clock never ran.
 */
export function formatDuration(ms: number): string {
  const { day, hour, minute, lessThanMinute } = strings.tasksPage.duration;

  if (ms < MINUTE) return lessThanMinute;

  if (ms >= DAY) {
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    return hours > 0 ? `${days}${day} ${hours}${hour}` : `${days}${day}`;
  }

  if (ms >= HOUR) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / MINUTE);
    return minutes > 0 ? `${hours}${hour} ${minutes}${minute}` : `${hours}${hour}`;
  }

  return `${Math.floor(ms / MINUTE)}${minute}`;
}
