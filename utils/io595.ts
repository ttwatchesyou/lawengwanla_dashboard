export const NANO_INPUTS = ["D2 → PB0", "D3 → PB1", "D4 → PB5", "D5 → PB9"];
export const LIMIT_INPUTS = ["PA1", "PA2", "PA3", "PA4", "PA5", "PA6", "PA7", "PA0"];
// Preserve physical channel positions across both eight-channel boards.
export const RELAY_GROUPS = [
  {title: "บอร์ด 1 · รีเลย์ A–H", board: 1, outputs: Array.from("ABCDEFGH", (output, i) => ({channel: i + 1, output, label: `รีเลย์ ${output}`}))},
  {title: "บอร์ด 2 · มอเตอร์ A–F", board: 2, outputs: Array.from("ABCDEF", (output, i) => ({channel: i + 9, output, label: `มอเตอร์ ${output}`}))},
  {title: "บอร์ด 2 · แม่เหล็ก G–H", board: 2, outputs: Array.from("GH", (output, i) => ({channel: i + 15, output, label: `แม่เหล็ก ${output}`}))},
];
export type Floor3State = {state: string; position: string; active: boolean; homed: boolean; center_configured: boolean; error: string};
export type FrontState = {state: "idle" | "zero" | "in" | "out" | "fault"; position: "unknown" | "in" | "out"; active: boolean; homed: boolean; pwm: number; pwm_percent: number; dir: 0 | 1; error: string};
export type Io595Packet = {schema: "lawengwanla.io595.v1"; board: "bluepill_f103c8";
  sequence: number; uptime_ms: number; armed: boolean; session: string; ack: number; mask: number;
  front?: FrontState; parallel_sliders?: boolean; travel_timeout_enabled?: boolean; active_level?: 0 | 1; floor3?: Floor3State; floor2?: Floor3State; floor1?: Floor3State; nano_levels: number[]; limit_raw: number[]; limit_levels: number[]};
export type Io595State = {connected: boolean; ready: boolean; age_ms: number | null; packet: Io595Packet | null; stop_generation?: number};

export function parseIo595(value: unknown): Io595State | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Io595State;
  const packet = state.packet;
  if (state.connected !== true || typeof state.ready !== "boolean" || !Number.isFinite(state.age_ms) || state.age_ms! < 0 || !packet ||
      packet.schema !== "lawengwanla.io595.v1" || packet.board !== "bluepill_f103c8") return null;
  if (packet.active_level !== undefined && packet.active_level !== 0 && packet.active_level !== 1) return null;
  const activeSliders: Floor3State[] = [];
  const parallel = packet.parallel_sliders === true;
  let allowed = 0;
  for (const [slider, masks] of [[packet.floor3, [0, 1, 2]], [packet.floor2, [0, 4, 8]], [packet.floor1, [0, 16, 32]]] as const) {
    if (slider === undefined) continue;
    if (!slider ||
        !["idle", "zero", "left", "right", "center_home", "center_left", "center_right", "fault"].includes(slider.state) ||
        !["unknown", "left", "center", "right"].includes(slider.position) ||
        [slider.active, slider.homed, slider.center_configured].some(x => typeof x !== "boolean") ||
        typeof slider.error !== "string" || slider.active !== !["idle", "fault"].includes(slider.state) ||
        (slider.active && ((packet.mask & (masks[1] | masks[2])) === (masks[1] | masks[2]) || (!parallel && !(masks as readonly number[]).includes(packet.mask))))) return null;
    if (slider.active) { activeSliders.push(slider); allowed |= masks[1] | masks[2]; }
  }
  if ((!parallel && activeSliders.length > 1) || (activeSliders.length > 0 && (packet.mask & ~allowed) !== 0)) return null;
  if (![packet.sequence, packet.uptime_ms, packet.ack, packet.mask].every(x => Number.isInteger(x) && x >= 0 && x <= 0xFFFFFFFF) ||
      packet.mask > 65535 || (activeSliders.length === 0 && (packet.mask & (packet.mask - 1)) !== 0) || typeof packet.armed !== "boolean" ||
      typeof packet.session !== "string" || !(packet.armed ? /^[0-9a-f]{16}$/ : /^$/).test(packet.session) ||
      (!packet.armed && packet.mask !== 0 && !(activeSliders.length > 0 && activeSliders.every(slider => slider.state === "zero"))) || (state.ready && !packet.armed)) return null;
  for (const [levels, counts] of [[packet.nano_levels, [4]], [packet.limit_raw, [7, 8]], [packet.limit_levels, [7, 8]]] as const) {
    if (!Array.isArray(levels) || !(counts as readonly number[]).includes(levels.length) || !levels.every(x => x === 0 || x === 1)) return null;
  }
  if (packet.limit_raw.length !== packet.limit_levels.length) return null;
  if (packet.front !== undefined) {
    const f = packet.front;
    if (!f || !["idle", "zero", "in", "out", "fault"].includes(f.state) ||
        !["unknown", "in", "out"].includes(f.position) ||
        typeof f.active !== "boolean" || typeof f.homed !== "boolean" ||
        f.active !== ["zero", "in", "out"].includes(f.state) ||
        !Number.isInteger(f.pwm) || ![0, 716].includes(f.pwm) ||
        f.pwm_percent !== 70 || ![0, 1].includes(f.dir) || typeof f.error !== "string" ||
        (f.pwm !== 0 && (!f.active || !packet.armed))) return null;
  }
  return state;
}

export function io595RelayLevel(packet: Io595Packet, on: boolean): "HIGH" | "LOW" {
  const activeHigh = packet.active_level === 1;
  return on === activeHigh ? "HIGH" : "LOW";
}

export function io595Live(state: Io595State | null, elapsedMs: number): state is Io595State & {packet: Io595Packet} {
  return !!state?.connected && !!state.packet && state.age_ms !== null &&
    Number.isFinite(elapsedMs) && elapsedMs >= 0 && state.age_ms + elapsedMs < 250;
}

// Input display tolerates brief HTTP jitter; relay control still uses 250 ms.
export function io595SensorsLive(state: Io595State | null, elapsedMs: number): state is Io595State & {packet: Io595Packet} {
  return !!state?.connected && !!state.packet && state.age_ms !== null &&
    Number.isFinite(elapsedMs) && elapsedMs >= 0 && state.age_ms + elapsedMs < 1000;
}
