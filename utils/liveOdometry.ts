import { RobotPose } from "./robotSimulation";
import { ExecutionSettings } from "./mainprogramSettings";
export type MapAnchor = {id: string; pose_epoch: string; odom_origin: number[]; map_origin: number[]; rotation: number; cell_m: number; pose_sequence: number};
export type PoseSample = {sequence: number; pose_epoch: string; pose: number[]; twist_world: number[]};
export type MainprogramState = {wheel_protocol?: string; wheel_port?: string; command_ack?: boolean; route_storage?: string; goal_event?: string; start_pending?: boolean;plan_key?: string; status: string; position_holding?: boolean; ready?: boolean; reason?: string; detail?: string; highest_reached?: number; waypoint_count?: number; target?: {label: string; x?: number; y?: number; speed?: number; tolerance?: number}; pose?: number[] | null; distance_m?: number; pose_fresh?: boolean; pose_age_ms?: number | null; pose_sequence?: number; pose_epoch?: string; pose_source?: string; heading_source?: string; twist_world?: number[]; map_anchor?: MapAnchor | null; pose_samples?: PoseSample[]};
export const finiteVector = (value: unknown, length=3): value is number[] => Array.isArray(value) && value.length === length && value.every(v => typeof v === "number" && Number.isFinite(v));
export function validAnchor(a: MapAnchor | null | undefined, epoch: string | undefined): a is MapAnchor {
  return !!a && a.pose_epoch===epoch && typeof a.id==="string" && finiteVector(a.odom_origin) && finiteVector(a.map_origin,2) && Number.isFinite(a.rotation) && a.cell_m>=.05 && a.cell_m<=2 && Number.isSafeInteger(a.pose_sequence);
}
export function measuredPose(raw: number[], anchor?: MapAnchor | null): RobotPose {
  if (!anchor) return {x:raw[0],y:raw[1],heading:raw[2]};
  const dx=raw[0]-anchor.odom_origin[0],dy=raw[1]-anchor.odom_origin[1],c=Math.cos(anchor.rotation),s=Math.sin(anchor.rotation);
  return {x:anchor.map_origin[0]+c*dx+s*dy,y:anchor.map_origin[1]-s*dx+c*dy,heading:Math.atan2(Math.sin(raw[2]-anchor.rotation),Math.cos(raw[2]-anchor.rotation))};
}
// Display-only reference: the first live reading is the known physical start.
// Subsequent positions use measured deltas; no commands are sent to the board.
export function startReference(state: MainprogramState, settings: ExecutionSettings): MapAnchor {
  return {id:`start:${state.pose_epoch}`,pose_epoch:state.pose_epoch!,
    odom_origin:state.pose!.slice(),
    map_origin:settings.start_mode === "outside_a6"
      ? [-settings.outside_clearance_m,7.5*settings.cell_m-2.0]
      : [.5*settings.cell_m,7.5*settings.cell_m],
    rotation:state.pose![2]-Math.PI/2,cell_m:settings.cell_m,
    pose_sequence:state.pose_sequence!};
}
export function livePoseFresh(state: MainprogramState | null, requestedAt: number, now: number, error=false): boolean {
  return !!state && !error && state.pose_source==="/lawengwanla/mainprogram/odom" && state.pose_fresh===true && finiteVector(state.pose) && typeof state.pose_epoch==="string" && Number.isSafeInteger(state.pose_sequence) &&
    typeof state.pose_age_ms==="number" && state.pose_age_ms>=0 && state.pose_age_ms+Math.max(0,now-requestedAt)<400;
}
export function actualMotion(raw: number[] | null, twist: number[] | undefined, fresh: boolean): string {
  if (!fresh) return "ข้อมูล odometry ขาด · ตำแหน่งล่าสุด";
  if (!raw || !finiteVector(twist)) return "รอความเร็วที่วัดได้";
  const c=Math.cos(raw[2]),s=Math.sin(raw[2]),forward=c*twist[0]+s*twist[1],left=-s*twist[0]+c*twist[1];
  const parts=[];
  if (Math.abs(forward)>.02) parts.push(forward>0?"เดินหน้า":"ถอยหลัง");
  if (Math.abs(left)>.02) parts.push(left>0?"สไลด์ซ้าย":"สไลด์ขวา");
  if (Math.abs(twist[2])>.03) parts.push(twist[2]>0?"หมุนซ้าย (ทวนเข็ม)":"หมุนขวา (ตามเข็ม)");
  return parts.join(" · ") || "หยุดนิ่งตาม odometry";
}
