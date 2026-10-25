export type AxisPidGains = { kp: number; ki: number; kd: number };
export type PositionPidProfile = {
  id: string;
  linear_mps: number;
  angular_radps: number;
  x: AxisPidGains;
  y: AxisPidGains;
  yaw: { kp: number; kd: number };
};
export type PositionPidAction = "pos_pid_x" | "pos_pid_y" | "yaw_pid";
export type PositionPidConfirmation = {
  gains: Partial<AxisPidGains> & { maximum?: number };
  command: string;
  ack: string;
  confirmed_at: number;
};
export const POSITION_PID_FIRMWARE = "pose-speed-hold-v27-tuning";
const finiteRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function validPositionPidProfile(value: unknown): value is PositionPidProfile {
  if (!value || typeof value !== "object") return false;
  const p = value as PositionPidProfile;
  return finiteRange(p.linear_mps, .01, 3.40282e38) && finiteRange(p.angular_radps, .01, 5) &&
    [p.x, p.y].every(axis => axis && [axis.kp, axis.ki, axis.kd].every(v => finiteRange(v, 0, 9999))) &&
    !!p.yaw && [p.yaw.kp, p.yaw.kd].every(v => finiteRange(v, 0, 9999));
}

export function positionPidRequest(profile: PositionPidProfile, action: PositionPidAction) {
  if (!validPositionPidProfile(profile)) throw new Error("กรอก PID 0–9999 · ความเร็ววิ่งตั้งแต่ 0.01 m/s · หมุน 0.01–5 rad/s");
  return action === "yaw_pid"
    ? { action, kp: profile.yaw.kp, kd: profile.yaw.kd, maximum: profile.angular_radps }
    : { action, ...profile[action === "pos_pid_x" ? "x" : "y"] };
}

export async function sendPositionPid(
  request: (path: string, body: Record<string, unknown>) => Promise<any>,
  profile: PositionPidProfile,
  actions: PositionPidAction[],
) {
  const payloads = actions.map(action => positionPidRequest(profile, action));
  const results = [];
  for (const payload of payloads) {
    const result = await request("/api/tuner/command", payload);
    if (!result.acknowledged || !result.ack) throw new Error("ยังไม่ได้รับ ACK จากบอร์ด · ตรวจค่าที่บอร์ดยืนยันก่อนส่งซ้ำ");
    results.push(result);
  }
  return results;
}
