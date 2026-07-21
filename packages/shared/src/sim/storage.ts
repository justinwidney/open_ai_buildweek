/**
 * The slice of the Web Storage API the local backend actually uses.
 *
 * Declared structurally rather than typed as `Storage` on purpose: this
 * package compiles with `lib: ["ES2022"]` and no DOM, it must stay importable
 * from Node (tests, the worker, a future SSR path), and a hand-rolled fake
 * has to be substitutable without pulling in `jsdom`. `window.localStorage`
 * and `window.sessionStorage` both satisfy this as-is.
 */
export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** An in-memory `KeyValueStorage`, for tests and for any environment without a real one (Node, SSR, a private-mode browser that throws on write). */
export function createMemoryStorage(initial?: Readonly<Record<string, string>>): KeyValueStorage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/**
 * True for the browser's "you're out of space" error, across the spellings
 * different engines use. Chrome/Safari throw a `DOMException` named
 * `QuotaExceededError` (code 22); Firefox uses `NS_ERROR_DOM_QUOTA_REACHED`
 * (code 1014). Safari in private mode historically threw the same for *any*
 * write, which is why the local store degrades instead of propagating.
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" || code === 22 || code === 1014;
}

/**
 * Returns the browser's `localStorage` when it is present *and writable*,
 * otherwise an in-memory fallback. The probe write is deliberate: merely
 * reading `window.localStorage` succeeds in Safari private mode and in
 * cookie-blocked contexts, and only the first `setItem` throws — checking at
 * construction turns that into a silent, working fallback rather than an
 * exception on the user's first save.
 */
export function resolveBrowserStorage(): KeyValueStorage {
  const candidate = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
  if (!candidate) return createMemoryStorage();
  try {
    const probe = "__control_ai_probe__";
    candidate.setItem(probe, "1");
    candidate.removeItem(probe);
    return candidate;
  } catch {
    return createMemoryStorage();
  }
}
