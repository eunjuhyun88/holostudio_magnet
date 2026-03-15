/* ─── Performance Utilities ───
 * Shared helpers for throttling, debouncing, and bounded collections.
 * Used across stores and pages to ensure safe operation at 1000+ concurrent users.
 */

/** Standard trailing-edge throttle. Guarantees at most one call per `ms` window. */
export function throttle<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const throttled = (...args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - last);

    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  };

  return throttled as T;
}

/** Standard trailing-edge debounce. Delays execution until `ms` of silence. */
export function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  };

  return debounced as T;
}

/** Prepend `item` to `arr`, capping total length at `maxSize`. Returns new array. */
export function cappedPrepend<T>(arr: T[], item: T, maxSize: number): T[] {
  if (arr.length >= maxSize) {
    return [item, ...arr.slice(0, maxSize - 1)];
  }
  return [item, ...arr];
}

/** Cap an array to `maxSize` by trimming from the end. Returns same ref if already within limit. */
export function capArray<T>(arr: T[], maxSize: number): T[] {
  if (arr.length <= maxSize) return arr;
  return arr.slice(0, maxSize);
}
