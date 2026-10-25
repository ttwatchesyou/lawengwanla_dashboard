import { TelemetrySnapshot, telemetryIsLive } from "./sensorTelemetry";

export const PROXIMITY_PINS = [2, 3, 4, 5, 6] as const;
export type ProximityState = "active" | "inactive" | "unknown";

export function proximityIndicators(snapshot: TelemetrySnapshot | null, elapsedMs: number, apiError = false): ProximityState[] {
  const unknown: ProximityState[] = PROXIMITY_PINS.map(() => "unknown");
  if (snapshot?.key !== "proximity" || !telemetryIsLive(snapshot, elapsedMs, apiError)) return unknown;
  const value = snapshot.data as Record<string, unknown> | null;
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    value.schema !== "lawengwanla.proximity.v1" || value.board !== "uno_r4_minima" || value.connected !== true ||
    value.active_low !== true || value.input_mode !== "INPUT_PULLUP" || value.debounce_ms !== 10 ||
    typeof value.host_epoch !== "string" || !value.host_epoch || value.host_epoch.length > 128 ||
    typeof value.sample_age_ms !== "number" || !Number.isFinite(value.sample_age_ms) || value.sample_age_ms < 0 || value.sample_age_ms >= 1000000 ||
    ![value.sequence, value.uptime_ms].every(v => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xffffffff) ||
    !Array.isArray(value.pins) || value.pins.length !== 5 || value.pins.some((pin, i) => pin !== PROXIMITY_PINS[i])) return unknown;
  const { raw, levels, active } = value;
  if (!Array.isArray(raw) || raw.length !== 5 || raw.some(v => v !== 0 && v !== 1) ||
    !Array.isArray(levels) || levels.length !== 5 || levels.some(v => v !== 0 && v !== 1) ||
    !Array.isArray(active) || active.length !== 5 || active.some((v, i) => typeof v !== "boolean" || v !== (levels[i] === 0))) return unknown;
  return active.map(v => v ? "active" : "inactive");
}
