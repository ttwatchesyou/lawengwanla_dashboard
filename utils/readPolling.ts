// Read-only scheduling. Command heartbeats and STOP must not use this scheduler.
export type PollEnvironment = {
  hidden: () => boolean;
  onVisibility: (listener: () => void) => () => void;
  setTimer: (callback: () => void, delay: number) => any;
  clearTimer: (timer: any) => void;
};
const browserEnvironment: PollEnvironment = {
  hidden: () => document.hidden,
  onVisibility: listener => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  },
  setTimer: (callback, delay) => setTimeout(callback, delay),
  clearTimer: timer => clearTimeout(timer),
};

export function startVisiblePolling(
  read: (signal: AbortSignal) => void | Promise<void>,
  intervalMs: number | (() => number),
  options: { timeoutMs?: number; environment?: PollEnvironment } = {},
) {
  const env = options.environment ?? browserEnvironment;
  let disposed = false, pending = false, refreshQueued = false;
  let timer: any, timeout: any, controller: AbortController | undefined;
  const schedule = (delay: number) => {
    env.clearTimer(timer);
    if (!disposed && !env.hidden()) timer = env.setTimer(() => { void tick().catch(() => {}); }, delay);
  };
  const tick = async () => {
    if (disposed || env.hidden() || pending) return;
    pending = true; refreshQueued = false;
    const active = new AbortController(); controller = active;
    if (options.timeoutMs) timeout = env.setTimer(() => active.abort(new DOMException("Read timed out", "TimeoutError")), options.timeoutMs);
    try { await read(active.signal); }
    finally {
      env.clearTimer(timeout); pending = false; controller = undefined;
      schedule(refreshQueued ? 0 : typeof intervalMs === "function" ? intervalMs() : intervalMs);
    }
  };
  const refresh = () => {
    if (disposed || env.hidden()) return;
    if (pending) refreshQueued = true;
    else schedule(0);
  };
  const removeVisibility = env.onVisibility(() => {
    if (env.hidden()) { env.clearTimer(timer); env.clearTimer(timeout); controller?.abort(); }
    else refresh();
  });
  // Catch unexpected callback failures: one read must not terminate polling.
  void tick().catch(() => {});
  return {
    refresh,
    stop: () => {
      disposed = true; env.clearTimer(timer); env.clearTimer(timeout);
      removeVisibility(); controller?.abort();
    },
  };
}

export type ReadStamp = { requestedAt: number; wallRequestedAt: number };
type Listener = { data: (value: any, stamp: ReadStamp) => void; error: (error: Error) => void; intervalMs: number };
const feeds = new Map<string, { listeners: Set<Listener>; poller: ReturnType<typeof startVisiblePolling> }>();

// Subscribers to one URL share a single in-flight request and timer per tab.
export function subscribeJson<T>(url: string, data: (value: T, stamp: ReadStamp) => void,
  error: (error: Error) => void, intervalMs: number, timeoutMs = 1800) {
  let feed = feeds.get(url);
  const listener: Listener = { data, error, intervalMs };
  if (!feed) {
    const listeners = new Set<Listener>();
    // Register before the first (async) response can arrive.
    listeners.add(listener);
    const poller = startVisiblePolling(async signal => {
      const stamp = { requestedAt: performance.now(), wallRequestedAt: Date.now() };
      try {
        const response = await fetch(url, { cache: "no-store", signal });
        if (!response.ok) throw new Error(`อ่านข้อมูลไม่สำเร็จ (${response.status})`);
        const value = await response.json();
        if (signal.aborted) return;
        for (const subscriber of listeners) {
          try { subscriber.data(value, stamp); }
          catch (cause) { subscriber.error(cause instanceof Error ? cause : new Error("ข้อมูลไม่ถูกต้อง")); }
        }
      } catch (cause) {
        if (!readWasCancelled(signal) && !document.hidden) for (const subscriber of listeners)
          subscriber.error(cause instanceof Error ? cause : new Error("อ่านข้อมูลไม่สำเร็จ"));
      }
    }, () => Math.min(...Array.from(listeners, s => s.intervalMs)), { timeoutMs });
    feed = { listeners, poller }; feeds.set(url, feed);
  } else feed.listeners.add(listener);
  return () => {
    feed!.listeners.delete(listener);
    if (!feed!.listeners.size) { feed!.poller.stop(); feeds.delete(url); }
  };
}
export function refreshJson(url: string) { feeds.get(url)?.poller.refresh(); }

export function readWasCancelled(signal: AbortSignal) {
  return signal.aborted && signal.reason?.name !== "TimeoutError";
}
