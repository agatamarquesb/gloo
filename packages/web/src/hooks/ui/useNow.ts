import { useEffect, useState } from 'react';

/** A minute, which is as fine as anything reading a clock on screen needs. */
const MINUTE = 60_000;

/**
 * The current time, re-rendering as it passes.
 *
 * The calendar has two things that are true only of *now*: the line across
 * today's column, and the dimming of everything the day has already finished
 * with. Both would otherwise be frozen at whatever moment the page was opened —
 * a tab left up over lunch would still be drawing the line at 11:00.
 *
 * Aligned to the top of the next minute rather than ticking every 60 seconds
 * from mount, so the line moves when the clock does. A stray second of drift is
 * invisible at 48px an hour, but a tick that lands mid-minute means the whole
 * grid re-renders at a moment nothing changed at.
 */
export function useNow(interval: number = MINUTE): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function schedule() {
      const next = interval - (Date.now() % interval);
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, next);
    }

    schedule();
    return () => clearTimeout(timer);
  }, [interval]);

  return now;
}
