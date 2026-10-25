export type TelemetrySnapshot = {
  key: string;
  label: string;
  topic: string;
  message_type: string;
  stale_ms: number;
  sequence: number;
  age_ms: number | null;
  fresh: boolean;
  state: string;
  publisher_count: number | null;
  data: unknown;
  error: string | null;
};

export type AnalogInductiveInput = {
  index: 2 | 3;
  pin: "A4" | "A5";
  adc_bits: 14;
  adc_max: 16383;
  adc_raw: number;
  low_threshold: number;
  high_threshold: number;
};

export type InductivePacket = {
  schema: string;
  board: string;
  sequence: number;
  uptime_ms: number;
  pins: (number | "A4" | "A5")[];
  input_mode: "INPUT" | "INPUT_PULLUP";
  active_low: true;
  raw: number[];
  levels: number[];
  active: boolean[];
  input_valid?: boolean[];
  analog_inputs?: AnalogInductiveInput[];
  connected: true;
  host_epoch: string;
  sample_age_ms: number;
  port?: string;
  parse_errors?: number;
};

export type TofReading = {
  model: "ZW_LRD10-R";
  direction: "front" | "rear" | "left" | "right";
  pin: "A0" | "A1" | "A2" | "A3";
  adcRaw: number;
  adcMax: 16383;
};

export type LimitPacket = {
  schema: "lawengwanla.limit.v1";
  board: "bluepill_f103c8";
  sequence: number;
  uptime_ms: number;
  pins: string[];
  raw: number[];
  levels: number[];
  active: boolean[];
  connected: true;
  host_epoch: string;
  sample_age_ms: number;
};

const LIMIT_PINS = ["PA11", "PA12", "PA8", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8", "PB9"];

const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function parseTelemetrySnapshot(value: unknown): TelemetrySnapshot {
  if (!record(value) || typeof value.key !== "string" || typeof value.label !== "string" ||
    typeof value.topic !== "string" || typeof value.message_type !== "string" ||
    !finite(value.stale_ms) || value.stale_ms < 100 || value.stale_ms > 10000 ||
    !Number.isInteger(value.sequence) || (value.sequence as number) < 0 ||
    !(value.age_ms === null || (finite(value.age_ms) && value.age_ms >= 0)) ||
    typeof value.fresh !== "boolean" || typeof value.state !== "string" ||
    !(value.publisher_count === null || (Number.isInteger(value.publisher_count) && (value.publisher_count as number) >= 0)) ||
    !(value.error === null || typeof value.error === "string")) {
    throw new Error("รูปแบบข้อมูล Telemetry ไม่ถูกต้อง");
  }
  return value as TelemetrySnapshot;
}

export function telemetryIsLive(snapshot: TelemetrySnapshot | null, elapsedMs: number, apiError = false): boolean {
  return !!snapshot && !apiError && snapshot.fresh && snapshot.state === "live" &&
    snapshot.error === null && snapshot.publisher_count === 1 && snapshot.age_ms !== null &&
    finite(elapsedMs) && elapsedMs >= 0 && snapshot.age_ms + elapsedMs < snapshot.stale_ms;
}

export function parseInductivePacket(value: unknown): InductivePacket | null {
  const mappings = [[2, 3, 4, 5], [2, 3, "A4", "A5"]];
  if (!record(value) || value.schema !== "lawengwanla.inductive.v1" || value.board !== "uno_r4_minima" ||
    value.connected !== true || value.active_low !== true || (value.input_mode !== "INPUT" && value.input_mode !== "INPUT_PULLUP") || value.debounce_ms !== 10 ||
    typeof value.host_epoch !== "string" || !value.host_epoch || value.host_epoch.length > 128 ||
    !finite(value.sample_age_ms) || value.sample_age_ms < 0 || value.sample_age_ms >= 1000000 ||
    !Number.isInteger(value.sequence) || (value.sequence as number) < 0 || (value.sequence as number) > 0xffffffff ||
    !Number.isInteger(value.uptime_ms) || (value.uptime_ms as number) < 0 || (value.uptime_ms as number) > 0xffffffff ||
    !Array.isArray(value.pins) || !mappings.some(mapping => Array.isArray(value.pins) && value.pins.length === 4 && value.pins.every((pin, i) => pin === mapping[i]))) return null;
  const raw = value.raw, levels = value.levels, active = value.active;
  if (!Array.isArray(raw) || raw.length !== 4 || raw.some(v => v !== 0 && v !== 1) ||
    !Array.isArray(levels) || levels.length !== 4 || levels.some(v => v !== 0 && v !== 1) ||
    !Array.isArray(active) || active.length !== 4 || active.some((v, i) => typeof v !== "boolean" || v !== (levels[i] === 0))) return null;
  if (value.pins[2] === "A4") {
    if (value.input_mode !== "INPUT" || !Array.isArray(value.input_valid) || value.input_valid.length !== 4 ||
      value.input_valid.some(v => typeof v !== "boolean") || !value.input_valid[0] || !value.input_valid[1] ||
      !Array.isArray(value.analog_inputs) || value.analog_inputs.length !== 2) return null;
    for (const [slot, index, pin] of [[0, 2, "A4"], [1, 3, "A5"]] as const) {
      const reading = value.analog_inputs[slot];
      if (!record(reading) || reading.index !== index || reading.pin !== pin || reading.adc_bits !== 14 || reading.adc_max !== 16383 ||
        !Number.isInteger(reading.adc_raw) || !Number.isInteger(reading.low_threshold) || !Number.isInteger(reading.high_threshold)) return null;
      const adc = reading.adc_raw as number, low = reading.low_threshold as number, high = reading.high_threshold as number;
      if (adc < 0 || adc > 16383 || low < 0 || low >= high || high > 16383 ||
        (adc <= low && raw[index] !== 0) || (adc >= high && raw[index] !== 1)) return null;
    }
  } else if (value.analog_inputs !== undefined || value.input_valid !== undefined) return null;
  return value as InductivePacket;
}

export function inductiveIndicators(snapshot: TelemetrySnapshot | null, elapsedMs: number, apiError = false): ("active" | "inactive" | "unknown")[] {
  const packet = parseInductivePacket(snapshot?.data);
  if (snapshot?.key !== "inductive" || !telemetryIsLive(snapshot, elapsedMs, apiError) || !packet) {
    return ["unknown", "unknown", "unknown", "unknown"];
  }
  return packet.active.map((active, index) => packet.input_valid?.[index] === false ? "unknown" : active ? "active" : "inactive");
}

export function parseLimitPacket(value: unknown): LimitPacket | null {
  if (!record(value) || value.schema !== "lawengwanla.limit.v1" || value.board !== "bluepill_f103c8" ||
    value.connected !== true || value.active_low !== true || value.input_mode !== "INPUT_PULLUP" || value.debounce_ms !== 10 ||
    typeof value.host_epoch !== "string" || !value.host_epoch || !finite(value.sample_age_ms) || value.sample_age_ms < 0 ||
    !Number.isInteger(value.sequence) || !Number.isInteger(value.uptime_ms) ||
    !Array.isArray(value.pins) || value.pins.length !== 10 || value.pins.some((pin, i) => pin !== LIMIT_PINS[i])) return null;
  const raw = value.raw, levels = value.levels, active = value.active;
  if (!Array.isArray(raw) || raw.length !== 10 || raw.some(v => v !== 0 && v !== 1) ||
    !Array.isArray(levels) || levels.length !== 10 || levels.some(v => v !== 0 && v !== 1) ||
    !Array.isArray(active) || active.length !== 10 || active.some((v, i) => typeof v !== "boolean" || v !== (levels[i] === 0))) return null;
  return value as LimitPacket;
}

export function limitIndicators(snapshot: TelemetrySnapshot | null, elapsedMs: number, apiError = false): ("active" | "inactive" | "unknown")[] {
  const packet = parseLimitPacket(snapshot?.data);
  if (snapshot?.key !== "limit" || !telemetryIsLive(snapshot, elapsedMs, apiError) || !packet) {
    return Array(10).fill("unknown");
  }
  return packet.active.map(active => active ? "active" : "inactive");
}

export function parseTofReadings(snapshot: TelemetrySnapshot | null, elapsedMs: number, apiError = false): TofReading[] | null {
  if (snapshot?.key !== "r4" || !telemetryIsLive(snapshot, elapsedMs, apiError) || !record(snapshot.data)) return null;
  const packet = snapshot.data;
  if ((packet.schema !== "lawengwanla.r4_sensors.v3" && packet.schema !== "lawengwanla.tof.v1") || packet.board !== "uno_r4_minima" ||
    packet.connected !== true || !Array.isArray(packet.tof) || packet.tof.length !== 4) return null;
  const expected = [{ direction: "front", pin: "A2" }, { direction: "rear", pin: "A3" },
    { direction: "left", pin: "A0" }, { direction: "right", pin: "A1" }] as const;
  const readings: TofReading[] = [];
  for (let index = 0; index < expected.length; index += 1) {
    const tof = packet.tof[index];
    if (!record(tof) || tof.model !== "ZW_LRD10-R" || tof.direction !== expected[index].direction ||
      tof.pin !== expected[index].pin || tof.adc_bits !== 14 || tof.adc_max !== 16383 ||
      !Number.isInteger(tof.adc_raw) || (tof.adc_raw as number) < 0 || (tof.adc_raw as number) > 16383) return null;
    readings.push({ model: "ZW_LRD10-R", direction: expected[index].direction, pin: expected[index].pin,
      adcRaw: tof.adc_raw as number, adcMax: 16383 });
  }
  return readings;
}


export const TOF_MOUNTING_OFFSETS_CM = {
  front: 4.1, rear: 10.30, left: 1.85, right: 3.1,
} as const;

// Return distance before mounting offset; the display adds it after filtering.
// Left uses the original A0 calibration.
// Right provisionally uses the same slope, anchored at the latest confirmed
// 30 cm chassis-edge measurement (50 samples, mean ADC 165.36, 2026-10-25).
// Other right distances are unvalidated: prior near/far readings conflict.
// Front uses its own 50/100 cm chassis-edge calibration, checked at 75 cm.
// Rear uses its own 20.5/50 cm chassis-edge calibration, independently checked
// at 35 cm. Subtract its mounting offset here to avoid adding it twice.
export function tofAdcToCentimeters(adc: number, direction?: TofReading["direction"]): number | null {
  if (!Number.isInteger(adc) || adc < 0 || adc > 16383) return null;
  if (direction === "front") {
    const edgeCm = 50 + (adc - 868.89) * 50 / (1755.01 - 868.89);
    return edgeCm - TOF_MOUNTING_OFFSETS_CM.front;
  }
  if (direction === "right") {
    const edgeCm = 30 + (adc - 165.36) * 50 / 898;
    return edgeCm - TOF_MOUNTING_OFFSETS_CM.right;
  }
  if (direction === "rear") {
    const edgeCm = 20.5 + (adc - 460.76666666666665) * 29.5 / (974.37 - 460.76666666666665);
    return edgeCm - TOF_MOUNTING_OFFSETS_CM.rear;
  }
  return 50 + (adc - 863.9833333333333) * 50 / 898;
}
