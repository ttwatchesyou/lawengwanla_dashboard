import { useSyncExternalStore } from "react";
import { refreshJson, subscribeJson } from "./readPolling";

export type ServiceData = {
  name: string; status: string; last_check: string; last_restart: string;
  auto_restart?: boolean;
};
type Snapshot = { services: ServiceData[]; ready: boolean | null; error: string };
const initial: Snapshot = { services: [], ready: null, error: "" };
let snapshot = initial;
const listeners = new Set<() => void>();
let unsubscribe: (() => void) | undefined;
const url = `${process.env.NEXT_PUBLIC_ROBOT_API ?? ""}/api/services`;
const notify = (next: Snapshot) => {
  if (JSON.stringify(snapshot) === JSON.stringify(next)) return;
  snapshot = next; listeners.forEach(listener => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!unsubscribe) unsubscribe = subscribeJson<any>(url, data => {
    notify({ services: Array.isArray(data) ? data : data.services ?? [], ready: data.system_ready ?? null, error: "" });
  }, error => notify({ ...snapshot, ready: false, error: error.message }), 3000, 3000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { unsubscribe?.(); unsubscribe = undefined; }
  };
};
export function useServiceStatus() {
  return useSyncExternalStore(subscribe, () => snapshot, () => initial);
}
export function refreshServices() { refreshJson(url); }
