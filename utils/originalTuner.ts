export const ORIGINAL_PROTOCOL = "stm32_original_gvps";
export const TUNER_INPUT_MAX = 9999;
export type Gains = { kp: number; ki: number; kd: number };
export type OriginalContract = {
  protocol: string; pwm_hz: number; config_source: string; config_sha256: string;
  numeric_input_max: number; command_ack: false;
  wheel_telemetry?: boolean; wheel_pid_tuning?: boolean; wheel_defaults?: Record<string, Gains>;
  wheel_run_timeout_ms?: number;
  goal_stop_policy?: Record<string, number>;
  position: { x: Gains; y: Gains; cruise_mps: number; yaw_kp: number; yaw_kd: number;
    yaw_max_rpm: number; yaw_min_rpm: number; yaw_tolerance_rad: number;
    acceleration_mps2: number; motor_max_rpm: number };
  commands: { command: string; function: string }[];
};
export type OriginalAction = "goal" | "twist" | "stop" | "pose_reset" | "pos_speed" | "yaw_pid" | "pos_pid_x" | "pos_pid_y" | "wheel_pid" | "wheel_rpm" | "wheel_info";
export type WheelTelemetry = { version: number; ms: number; enabled: boolean; mask: number; imu_fresh: boolean;
  target_rpm_each: number[]; rpm: number[]; pwm: number[]; ticks: number[] };
export type WheelSample = WheelTelemetry & { seq: number; t: number };
export type WheelReadback = Record<string, { gains: Gains; sequence: number; received_at: number }>;
export function originalRequest(action: OriginalAction, values: Record<string, unknown> = {}) {
  const number = (key: string, signed = false, positive = false) => {
    const v = values[key];
    if (typeof v !== "number" || !Number.isFinite(v) || v < (signed ? -9999 : 0) || v > 9999 || (positive && v <= 0))
      throw Error(`${key}: กรอก${positive ? "ค่ามากกว่า 0" : "ค่าที่ถูกต้อง"} ถึง 9999`);
    return v;
  };
  switch (action) {
    case "wheel_pid": {
      if (!["FL", "FR", "RL", "RR"].includes(String(values.wheel))) throw Error("เลือก FL/FR/RL/RR");
      return { action, wheel: values.wheel, kp: number("kp"), ki: number("ki"), kd: number("kd") };
    }
    case "wheel_rpm": {
      if (![1, 2, 4, 8, 15].includes(values.mask as number)) throw Error("เลือกกลุ่มล้อที่ถูกต้อง");
      const rpm = number("rpm", true);
      if (Math.abs(rpm) > 300) throw Error("ทดสอบได้ -300 ถึง 300 RPM ตาม normalization ของบอร์ด");
      return { action, mask: values.mask, rpm };
    }
    case "goal": return { action, x: number("x", true), y: number("y", true), yaw: number("yaw", true) };
    case "twist": return { action, vx: number("vx", true), vy: number("vy", true) };
    case "yaw_pid": return { action, max_rpm: number("max_rpm", false, true), kp: number("kp", false, true), kd: number("kd", false, true) };
    case "pos_pid_x": case "pos_pid_y": return { action, kp: number("kp"), ki: number("ki"), kd: number("kd") };
    case "pos_speed": return { action, speed: number("speed", false, true) };
    default: return { action };
  }
}
