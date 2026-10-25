import { Io595Packet, Io595State, io595Live } from "./io595";

export type SliderFloor = 1 | 2 | 3;
export type SliderTarget = "left" | "center" | "right";
export const FRONT_WIRING = { inLimit: 6, outLimit: 5, pwmPin: "PB6", dirPin: "PB15", pwmPercent: 70 } as const;
export const SLIDER_FLOORS = [3, 2, 1] as const;
// Indices match the MCU's limitPins and nanoPins arrays, not the retired board.
export const SLIDER_WIRING = {
  1: { left: 7, right: 0, center: 0, leftRelay: 5, rightRelay: 6 },
  2: { left: 1, right: 2, center: 2, leftRelay: 4, rightRelay: 3 },
  3: { left: 3, right: 4, center: 1, leftRelay: 2, rightRelay: 1 },
} as const;
export const SLIDER_VALUE: Record<SliderTarget, number> = { left: 1, center: 2, right: 3 };
export const sliderState = (packet: Io595Packet | null, floor: SliderFloor) => packet?.[`floor${floor}` as "floor1" | "floor2" | "floor3"];
export const sliderError = (reason: string) => ({
  both_limits: "ลิมิตซ้ายและขวาทำงานพร้อมกัน",
  conflicting_sensors: "ลิมิตปลายและอินดักทีฟกลางทำงานพร้อมกัน",
  center_not_found: "ถึงลิมิตปลายก่อนพบอินดักทีฟกลาง",
  center_unconfigured: "ยังไม่ได้เปิดใช้เซนเซอร์กลาง",
  command_timeout: "การเชื่อมต่อขาดช่วง · หยุดแล้ว",
  conflicting_directions: "คำสั่งทิศทางขัดกัน",
}[reason] ?? reason);

export function sliderCommandAllowed(state: Io595State | null, elapsedMs: number, floor: SliderFloor, target: SliderTarget) {
  if (!io595Live(state, elapsedMs) || !state.ready) return false;
  const axis = sliderState(state.packet, floor);
  if (!axis || (target === "center" && (!axis.center_configured || SLIDER_WIRING[floor].center === null))) return false;
  if (!state.packet.parallel_sliders && SLIDER_FLOORS.some(f => f !== floor && sliderState(state.packet, f)?.active)) return false;
  // A held manual channel must finish before an automatic target starts.
  if (state.packet.mask && !SLIDER_FLOORS.some(f => sliderState(state.packet, f)?.active)) return false;
  return true;
}

export function frontCommandAllowed(state: Io595State | null, elapsedMs: number) {
  if (!io595Live(state, elapsedMs) || !state.ready || !state.packet.front) return false;
  return !state.packet.mask || SLIDER_FLOORS.some(f => sliderState(state.packet, f)?.active);
}
