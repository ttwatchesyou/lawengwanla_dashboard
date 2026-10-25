type Gains = { kp: number; ki: number; kd: number };
type Request = (path: string, body: Record<string, unknown>) => Promise<any>;

// STOP clears the device's selection, so every PID send selects its wheels
// explicitly. This sequence configures gains without starting the motors.
export async function sendWheelPid(request: Request, mask: number, gains: Gains) {
  if (!Number.isInteger(mask) || mask < 1 || mask > 15 ||
      ![gains.kp, gains.ki, gains.kd].every(value =>
        typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100)) {
    throw new Error("เลือกชุดล้อและกรอก Kp/Ki/Kd ระหว่าง 0–100 ให้ครบ");
  }
  await request("/api/tuner/command", { action: "select", mask });
  const result = await request("/api/tuner/command", { action: "pid", ...gains });
  if (!result.acknowledged || result.ack !== "T:ACK:PID") {
    throw new Error("บอร์ดยังไม่ยืนยัน PID ล้อ (ACK)");
  }
  return result;
}
