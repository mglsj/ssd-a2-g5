type Entry<T> = { at: number; value: Promise<T>; settled: boolean };

/**
 * Caches a slow async call by key. Concurrent callers share one run. A result
 * is fresh for `ttlMs`. After that it is served once more while a new run
 * starts in the background, until it is older than `staleMs`. Failed runs are
 * not kept.
 */
export function ttlCache<A, T>(ttlMs: number, staleMs: number, key: (arg: A) => string, load: (arg: A) => Promise<T>) {
  const entries = new Map<string, Entry<T>>();

  const start = (k: string, arg: A, now: number): Entry<T> => {
    const value = load(arg);
    const entry: Entry<T> = { at: now, value, settled: false };
    entries.set(k, entry);
    value.then(
      () => {
        entry.settled = true;
      },
      () => {
        if (entries.get(k) === entry) entries.delete(k);
      },
    );
    return entry;
  };

  const get = (arg: A): Promise<T> => {
    const k = key(arg);
    const now = Date.now();
    for (const [other, entry] of entries) if (now - entry.at >= staleMs) entries.delete(other);

    const hit = entries.get(k);
    if (!hit) return start(k, arg, now).value;
    if (now - hit.at < ttlMs || !hit.settled) return hit.value;
    // Stale but usable: answer now, refresh for the next caller.
    start(k, arg, now);
    return hit.value;
  };

  return Object.assign(get, { clear: () => entries.clear() });
}
