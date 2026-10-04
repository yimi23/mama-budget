// The read scheduler's timing, pure. A trailing debounce (wait for the page to go quiet) with a ceiling: a page that
// never goes quiet (a drawer animating, a carousel ticking, a price updating every 200 ms) must not keep her waiting.
// Measured live on allbirds.com before this: six seconds from the Add to cart click to her card, all of it the timer
// being reset by mutations.

export const MAX_WAIT_MS = 1000;

/**
 * How long to wait before the next read: the requested delay, cut to what is left of the ceiling since the first
 * unserved request. `firstAt` is null when nothing is pending.
 */
export function nextDelay(delay: number, firstAt: number | null, now: number, maxWait = MAX_WAIT_MS): number {
  if (firstAt == null) return Math.max(0, delay);
  const remaining = maxWait - (now - firstAt);
  return Math.max(0, Math.min(delay, remaining));
}
