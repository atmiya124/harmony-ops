// In-memory data cache for the browser, so screens the partner has already
// seen render instantly on the next visit while fresh data loads behind
// them (stale-while-revalidate). Memory only: nothing is written to disk,
// and a reload or sign-out starts empty.

const store = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function peekCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setCache<T>(key: string, value: T): void {
  store.set(key, value);
}

// Applies a change to a cached value, if there is one (e.g. put an edited
// booking into the cached list so the list is right when you go back).
export function updateCache<T>(key: string, change: (current: T) => T): void {
  if (store.has(key)) store.set(key, change(store.get(key) as T));
}

// Forgets every entry whose key starts with one of the prefixes.
export function invalidateCache(...prefixes: string[]): void {
  for (const key of [...store.keys()]) if (prefixes.some((p) => key.startsWith(p))) store.delete(key);
}

// Loads fresh data and caches it. Concurrent requests for the same key share
// one network call.
export function loadCached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const request = loader()
    .then((value) => {
      store.set(key, value);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

// For tests.
export function clearCache(): void {
  store.clear();
  inflight.clear();
}
