import { MazeCell } from "./mazeRoute";
import { RackSelection } from "./rackMission";
import { WaypointSettingsMap } from "./waypointSettings";
import {
  buildRetryPlan,
  missionPlanKey,
  missionTasks,
  RetryPhase,
  RetrySnapshot,
} from "./missionRetry";

export const MISSION_STATUS_MAX_AGE_MS = 1500;
export const MISSION_STATUS_TOPIC = "/lawengwanla/mission_status";
export type TaskState =
  | "pending"
  | "in_progress"
  | "completed"
  | "result_unknown";
export type MissionStatus = {
  schema_version: 1;
  source: "controller_ack" | "wheel_feedback";
  plan_key: string;
  run_id: string;
  pose_epoch: string;
  sequence: number;
  highest_reached: number;
  phase: RetryPhase;
  run_state:
    | "idle"
    | "running"
    | "paused"
    | "retry_required"
    | "completed"
    | "faulted";
  tasks: Record<string, TaskState>;
  block_dropped: boolean;
  stopped: boolean;
  localization_valid: boolean;
};
export type MissionStatusPacket = {
  state: MissionStatus | null;
  age_ms: number | null;
  fresh: boolean;
  publisher_count: number | null;
  error: string | null;
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

export function parseMissionStatus(value: unknown): MissionStatusPacket {
  if (
    !record(value) ||
    value.source_topic !== MISSION_STATUS_TOPIC ||
    typeof value.fresh !== "boolean" ||
    !(
      value.age_ms === null ||
      (typeof value.age_ms === "number" &&
        Number.isFinite(value.age_ms) &&
        value.age_ms >= 0)
    ) ||
    !(
      value.publisher_count === null ||
      (Number.isInteger(value.publisher_count) &&
        Number(value.publisher_count) >= 0)
    )
  )
    throw Error("รูปแบบข้อมูลสถานะภารกิจไม่ถูกต้อง");
  const state = value.state;
  if (state !== null) {
    if (
      !record(state) ||
      state.schema_version !== 1 ||
      !["controller_ack", "wheel_feedback"].includes(state.source as string)
    )
      throw Error("สถานะต้องมาจาก ACK หรือข้อมูลวัดจริงของตัวรัน");
    for (const [key, limit] of [
      ["plan_key", 32768],
      ["run_id", 128],
      ["pose_epoch", 128],
    ] as const)
      if (
        typeof state[key] !== "string" ||
        !(state[key] as string).length ||
        (state[key] as string).length > limit
      )
        throw Error("ข้อมูล run / plan / pose epoch ไม่ครบ");
    if (
      !Number.isSafeInteger(state.sequence) ||
      Number(state.sequence) < 0 ||
      !Number.isInteger(state.highest_reached) ||
      Number(state.highest_reached) < 0 ||
      Number(state.highest_reached) > 37 ||
      !["maze", "cabinet2", "folder", "finished"].includes(
        state.phase as string
      ) ||
      ![
        "idle",
        "running",
        "paused",
        "retry_required",
        "completed",
        "faulted",
      ].includes(state.run_state as string)
    )
      throw Error("ลำดับหรือช่วงภารกิจไม่ถูกต้อง");
    if (
      !["block_dropped", "stopped", "localization_valid"].every(
        (key) => typeof state[key] === "boolean"
      )
    )
      throw Error("ไม่มีสถานะยืนยันหุ่นหยุด/ชิ้นงาน/พิกัด");
    if (
      !record(state.tasks) ||
      Object.keys(state.tasks).length < 1 ||
      Object.keys(state.tasks).length > 64 ||
      Object.entries(state.tasks).some(
        ([id, status]) =>
          !/^[A-Za-z0-9._-]{1,128}$/.test(id) ||
          !["pending", "in_progress", "completed", "result_unknown"].includes(
            status as string
          )
      )
    )
      throw Error("ข้อมูลสถานะงานไม่ครบหรือไม่ถูกต้อง");
    if (state.source === "wheel_feedback" && (state.phase !== "maze" ||
      Object.entries(state.tasks).some(([id, status]) => id !== "maze.drive" && status !== "pending")))
      throw Error("พิกัดล้อยืนยันได้เฉพาะงานเดิน ยังยืนยันงานชุดจับไม่ได้");
  }
  return {
    state:
      state === null
        ? null
        : (JSON.parse(JSON.stringify(state)) as MissionStatus),
    age_ms: value.age_ms as number | null,
    fresh: value.fresh,
    publisher_count: value.publisher_count as number | null,
    error: typeof value.error === "string" ? value.error : null,
  };
}

export function missionStatusFresh(
  packet: MissionStatusPacket | null,
  receivedAt: number,
  now: number
) {
  return (
    !!packet?.state &&
    packet.fresh &&
    !packet.error &&
    packet.publisher_count === 1 &&
    packet.age_ms !== null &&
    packet.age_ms + Math.max(0, now - receivedAt) < MISSION_STATUS_MAX_AGE_MS
  );
}

export function retryFromMissionStatus(
  route: MazeCell[],
  selection: RackSelection,
  settings: WaypointSettingsMap,
  packet: MissionStatusPacket | null,
  fresh: boolean
) {
  const state = packet?.state;
  if (!state)
    return {
      plan: null,
      errors: ["รอสถานะภารกิจจากตัวรัน ROS2 ยังไม่ทราบว่าหุ่นทำถึงขั้นตอนไหน"],
    };
  if (state.source === "wheel_feedback")
    return { plan: null, errors: ["แสดงความคืบหน้าจากพิกัดวัดจริง · ยังไม่สร้างแผน Retry จากข้อมูลที่ไม่มี ACK รายจุด"] };
  if (state.plan_key !== missionPlanKey(route, selection, settings))
    return {
      plan: null,
      errors: ["สถานะเป็นของแผนอื่น กรุณาเปิดแผนที่ตรงกับภารกิจบนหุ่นก่อน"],
    };
  const expected = missionTasks(selection).map((task) => task.id);
  if (
    Object.keys(state.tasks).length !== expected.length ||
    expected.some(
      (id) => !Object.prototype.hasOwnProperty.call(state.tasks, id)
    )
  )
    return {
      plan: null,
      errors: ["ตัวรันส่งสถานะงานไม่ครบทุกงาน จึงยังตัดสินใจข้ามภารกิจไม่ได้"],
    };
  const snapshot: RetrySnapshot = {
    plan_key: state.plan_key,
    source: "controller_ack",
    highest_reached: state.highest_reached,
    phase: state.phase,
    completed: expected.filter((id) => state.tasks[id] === "completed"),
    uncertain: expected.filter((id) =>
      ["in_progress", "result_unknown"].includes(state.tasks[id])
    ),
  };
  const plan = buildRetryPlan(
    route,
    selection,
    settings,
    snapshot,
    state.block_dropped
  );
  const errors = [...plan.errors];
  if (!fresh)
    errors.unshift("สถานะขาดหรือเก่าเกินกำหนด รอข้อมูลสดก่อนตรวจ Retry");
  if (
    !state.stopped ||
    !["paused", "retry_required", "faulted"].includes(state.run_state)
  )
    errors.unshift(
      state.run_state === "completed"
        ? "ภารกิจจบแล้ว ไม่ต้อง Retry"
        : "รอ ACK ว่าหุ่นหยุด และตัวรันอยู่ในสถานะพัก/ขอ Retry ก่อน"
    );
  return { plan, errors: Array.from(new Set(errors)) };
}

export function missionReviewKey(state: MissionStatus | null) {
  if (!state) return "none";
  const { sequence, ...content } = state;
  return JSON.stringify({
    ...content,
    tasks: Object.fromEntries(
      Object.entries(content.tasks).sort(([a], [b]) => a.localeCompare(b))
    ),
  });
}
