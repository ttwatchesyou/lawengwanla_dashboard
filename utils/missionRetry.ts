import { CELL_METERS, cellKey, cellLabel, MazeCell } from "./mazeRoute";
import { missionChecks } from "./missionReadiness";
import { rackCellLabel, rackMission, RackSelection } from "./rackMission";
import { FIXED_HEADING_DEG, ROBOT_INITIAL_HEADING_DEG } from "./robotSimulation";
import { settingsForCell, WaypointSettingsMap } from "./waypointSettings";

// A contract for a future acknowledged mission executor, NOT a hardware command.
export const RETRY_POLICY = {
  version: 1,
  checkpoint_sequence: 19,
  checkpoint_source: "highest_controller_acknowledged_arrival",
  before_checkpoint: "external_start_left_of_A6",
  after_checkpoint: "route_sequence_19_not_fixed_grid_coordinate",
  progress_owner: "robot_executor_durable_ack_ledger",
  independent_tracks: ["movement", "blocks", "sheet"],
  retry_does_not_reset_completed_tasks: true,
  task_replay: "idempotency_key_plus_ack_reconcile_unknown_before_replay",
  block_drop:
    "request_all_block_magnets_then_wait_for_safe_regrip_ack_skip_source_block_pick",
  pending_sheet_pick_is_not_skipped: true,
  station_resume: "pending_station_task_not_maze_checkpoint",
  localization:
    "stop_cancel_old_goals_reanchor_map_to_odom_reset_controller_validate_then_arm",
  fixed_heading_deg: ROBOT_INITIAL_HEADING_DEG,
  execution_available: false,
} as const;

export type RetryPhase = "maze" | "cabinet2" | "folder" | "finished";
export type RetrySnapshot = {
  plan_key: string;
  source: "sandbox" | "controller_ack";
  highest_reached: number;
  phase: RetryPhase;
  completed: string[];
  uncertain: string[];
};
export type MissionTask = {
  id: string;
  label: string;
  track: "blocks" | "sheet";
  station: "cabinet1" | "mobile" | "cabinet2" | "folder";
  requires: string[];
};

// Full canonical content rather than a short collision-prone hash. It binds progress
// to route order, rack contents AND effective waypoint parameters (not just length).
export function missionPlanKey(
  route: MazeCell[],
  selection: RackSelection,
  settings: WaypointSettingsMap
) {
  return JSON.stringify({
    version: 1,
    route: route.map((cell) => ({
      cell: cellKey(cell),
      ...settingsForCell(settings, cell),
      heading_deg: ROBOT_INITIAL_HEADING_DEG,
    })),
    rack: rackMission(selection),
  });
}

export function missionTasks(selection: RackSelection): MissionTask[] {
  return [
    {
      id: "blocks.pick",
      label: "ดูดบล็อกจากตู้แรก",
      track: "blocks",
      station: "cabinet1",
      requires: [],
    },
    {
      id: "blocks.retract",
      label: "ถอยออกจากตู้แรก",
      track: "blocks",
      station: "cabinet1",
      requires: ["blocks.pick"],
    },
    {
      id: "blocks.arrange",
      label: "จัดเรียงบล็อกให้ตรงตู้วาง",
      track: "blocks",
      station: "mobile",
      requires: ["blocks.retract"],
    },
    ...selection.picks.map(
      (cell, index): MissionTask => ({
        id: `blocks.place.${rackCellLabel(cell)}`,
        label: `วางบล็อก ${index + 1} (หยิบ ${rackCellLabel(cell)}) ที่ตู้สอง`,
        track: "blocks",
        station: "cabinet2",
        requires: ["blocks.arrange"],
      })
    ),
    {
      id: "sheet.pick",
      label: `หยิบแผ่นเหล็ก ${selection.plate ?? "—"} จากตู้แรก`,
      track: "sheet",
      station: "cabinet1",
      requires: [],
    },
    {
      id: "sheet.load",
      label: "นำแผ่นเหล็กเข้าเครื่องพับ",
      track: "sheet",
      station: "folder",
      requires: ["sheet.pick"],
    },
    {
      id: "sheet.fold",
      label: "พับแผ่นเหล็ก",
      track: "sheet",
      station: "folder",
      requires: ["sheet.load"],
    },
    {
      id: "sheet.collect",
      label: "รับชิ้นงานจากเครื่องพับ",
      track: "sheet",
      station: "folder",
      requires: ["sheet.fold"],
    },
  ];
}

export function emptyRetrySnapshot(planKey: string): RetrySnapshot {
  return {
    plan_key: planKey,
    source: "sandbox",
    highest_reached: 0,
    phase: "maze",
    completed: [],
    uncertain: [],
  };
}

export function retryScenario(
  planKey: string,
  tasks: MissionTask[],
  scenario: "before19" | "after19" | "folder"
): RetrySnapshot {
  const completed =
    scenario === "folder"
      ? tasks
          .filter(
            (task) =>
              task.track === "blocks" ||
              ["sheet.pick", "sheet.load"].includes(task.id)
          )
          .map((task) => task.id)
      : ["blocks.pick", "blocks.retract", "blocks.arrange", "sheet.pick"];
  return {
    plan_key: planKey,
    source: "sandbox",
    highest_reached:
      scenario === "before19" ? 18 : scenario === "after19" ? 23 : 37,
    phase: scenario === "folder" ? "folder" : "maze",
    completed,
    uncertain: [],
  };
}

export function buildRetryPlan(
  route: MazeCell[],
  selection: RackSelection,
  settings: WaypointSettingsMap,
  snapshot: RetrySnapshot,
  blockDropped: boolean
) {
  const tasks = missionTasks(selection),
    ids = new Set(tasks.map((task) => task.id));
  const done = new Set(snapshot.completed),
    unknown = new Set(snapshot.uncertain);
  const errors: string[] = [];
  for (const check of missionChecks(route, selection, settings)) {
    if (!check.passed) errors.push(check.label);
  }
  if (snapshot.plan_key !== missionPlanKey(route, selection, settings))
    errors.push(
      "แผนเปลี่ยนแล้ว ต้องตรวจความคืบหน้าใหม่ ห้ามนำ checkpoint จากแผนเก่ามาใช้"
    );
  if (!["sandbox", "controller_ack"].includes(snapshot.source))
    errors.push(
      "แหล่งความคืบหน้าไม่ถูกต้อง ต้องเป็น ACK จากตัวรันหรือโหมดทดสอบที่ระบุชัดเจน"
    );
  if (
    !Number.isInteger(snapshot.highest_reached) ||
    snapshot.highest_reached < 0 ||
    snapshot.highest_reached > route.length
  )
    errors.push("ลำดับที่ไปถึงต้องเป็นจำนวนเต็ม 0–37");
  if (!["maze", "cabinet2", "folder", "finished"].includes(snapshot.phase))
    errors.push("ช่วงภารกิจไม่ถูกต้อง");
  if ([...snapshot.completed, ...snapshot.uncertain].some((id) => !ids.has(id)))
    errors.push("มีงานที่ไม่อยู่ในภารกิจนี้ ต้องตรวจ ledger ใหม่");
  if (unknown.size)
    errors.push(
      "มีงานที่ไม่รู้ว่าเสร็จหรือยัง: ต้องอ่านสถานะจริง/ตรวจชิ้นงานก่อน ห้ามทำซ้ำอัตโนมัติ"
    );
  for (const task of tasks) {
    if (done.has(task.id) && task.requires.some((id) => !done.has(id)))
      errors.push(
        `สถานะขัดกัน: ${task.label} ถูกบันทึกว่าเสร็จ แต่งานก่อนหน้ายังไม่ยืนยัน`
      );
    if (done.has(task.id) && unknown.has(task.id))
      errors.push(`สถานะขัดกัน: ${task.label} ทั้งเสร็จและไม่ทราบผล`);
  }
  const placements = tasks.filter((task) => task.station === "cabinet2");
  const allPlaced =
    placements.length > 0 && placements.every((task) => done.has(task.id));
  const pending = tasks.filter((task) => !done.has(task.id));
  const pendingSource = pending.filter((task) => task.station === "cabinet1");
  if (snapshot.phase === "maze" && placements.some((task) => done.has(task.id)))
    errors.push(
      "มีบันทึกวางบล็อกแล้ว กรุณาเลือกช่วงตู้สอง/เครื่องพับ ไม่ย้อนกลับไปวิ่งเขาวงกต"
    );
  if (snapshot.phase !== "maze" && pendingSource.length)
    errors.push(
      "อยู่ปลายทางแต่ยังไม่มีการยืนยันงานตู้แรก ต้องตรวจบล็อก/แผ่นเหล็กก่อนวางแผนกลับเข้าเส้นทาง"
    );
  if (
    (snapshot.phase === "folder" || snapshot.phase === "finished") &&
    !allPlaced
  )
    errors.push("ก่อนข้ามตู้สอง ต้องยืนยันการวางบล็อกที่เลือกครบทุกลูก");
  if (snapshot.phase === "finished" && pending.length)
    errors.push("ยังมีงานค้าง จึงยังระบุว่าจบภารกิจไม่ได้");
  if (blockDropped && (!done.has("blocks.pick") || allPlaced))
    errors.push(
      "เหตุบล็อกร่วงขัดกับสถานะการหยิบ/วาง กรุณาตรวจว่าบล็อกใดยังต้องขนส่ง"
    );
  if (blockDropped && snapshot.phase === "folder")
    errors.push(
      "อยู่เครื่องพับหลังวางครบแล้ว: ต้องตรวจเหตุบล็อกร่วงกับผู้ควบคุม ไม่เปิดแม่เหล็กซ้ำอัตโนมัติ"
    );
  const checkpoint =
    snapshot.highest_reached >= RETRY_POLICY.checkpoint_sequence;
  if (snapshot.phase === "maze" && checkpoint && pendingSource.length)
    errors.push(
      "กลับเข้าช่อง 19 แต่ยังมีงานตู้แรกค้าง (รวมแผ่นเหล็ก) ต้องยืนยันการกู้คืนชิ้นงานก่อน ไม่ข้ามงานนั้นเอง"
    );
  const routeStart = checkpoint ? RETRY_POLICY.checkpoint_sequence : 1;
  const anchorCell = checkpoint ? route[18] : undefined;
  const destination =
    snapshot.phase === "maze"
      ? checkpoint
        ? "checkpoint19"
        : "start"
      : snapshot.phase === "finished"
      ? "finished"
      : allPlaced
      ? "folder"
      : "cabinet2";
  return {
    version: 1,
    kind: "retry_plan_preview_only",
    executable: false,
    source: snapshot.source,
    plan_key: snapshot.plan_key,
    errors: Array.from(new Set(errors)),
    destination,
    checkpoint_latched: checkpoint,
    movement: {
      highest_acknowledged_sequence: snapshot.highest_reached,
      phase: snapshot.phase,
      anchor:
        snapshot.phase === "maze"
          ? checkpoint
            ? {
                type: "route_cell",
                sequence: 19,
                cell: anchorCell ? cellLabel(anchorCell) : null,
                nominal_map_pose: anchorCell
                  ? {
                      x_m: (anchorCell.col + 0.5) * CELL_METERS,
                      y_m: (anchorCell.row + 0.5) * CELL_METERS,
                      heading_deg: FIXED_HEADING_DEG,
                    }
                  : null,
                nominal_pose_is_not_a_localization_measurement: true,
              }
            : {
                type: "external_start",
                aligned_to: "left_of_A6",
                surveyed_pose_required: true,
              }
          : {
              type: "station_docking",
              station: destination,
              surveyed_pose_required: true,
            },
      route_sequences:
        snapshot.phase === "maze"
          ? route.slice(routeStart - 1).map((_, i) => routeStart + i)
          : [],
      include_external_start_approach: snapshot.phase === "maze" && !checkpoint,
      route_19_is_anchor_not_a_jump_command: true,
    },
    recovery_actions: blockDropped
      ? [
          {
            id: "blocks.regrip",
            action: "request_all_block_gripper_magnets_on",
            requires: [
              "stationary_controller_ack",
              "operator_confirms_reloaded_blocks_and_clear_grippers",
            ],
            completion: "controller_ack_and_verified_block_presence",
            skip_source_block_pick: true,
          },
          {
            id: "blocks.rearrange",
            action: "verify_or_restore_carried_block_arrangement",
            completion: "controller_ack",
          },
        ]
      : [],
    tracks: {
      blocks: {
        completed: tasks
          .filter((task) => task.track === "blocks" && done.has(task.id))
          .map((task) => task.id),
        pending: pending
          .filter((task) => task.track === "blocks")
          .map((task) => task.id),
      },
      sheet: {
        completed: tasks
          .filter((task) => task.track === "sheet" && done.has(task.id))
          .map((task) => task.id),
        pending: pending
          .filter((task) => task.track === "sheet")
          .map((task) => task.id),
      },
    },
    pending_tasks: pending,
    skip_cabinet1: pendingSource.length === 0,
    skip_cabinet2: allPlaced,
    safety_handshake: [
      "pause_and_wait_for_stationary_ack",
      "cancel_old_goals_and_reconcile_in_flight_actions",
      "operator_reposition_and_confirm_physical_anchor",
      "capture_fresh_odom_and_validate_map_anchor_heading",
      "recompute_map_to_odom_in_new_pose_epoch",
      "reset_pid_integrators_trajectory_and_velocity_targets",
      "verify_regrip_if_requested_and_station_resource_interlocks",
      "explicit_resume_ack_then_ramp_velocity_with_watchdog",
    ],
    policy: RETRY_POLICY,
  };
}

export type Pose2D = { x: number; y: number; yaw: number };
// Pure SE(2) arithmetic for design/tests. This never updates TF or robot state.
export function previewMapToOdom(mapBase: Pose2D, odomBase: Pose2D): Pose2D {
  if (
    ![
      mapBase.x,
      mapBase.y,
      mapBase.yaw,
      odomBase.x,
      odomBase.y,
      odomBase.yaw,
    ].every(Number.isFinite)
  )
    throw new Error("Pose must be finite");
  const yaw = Math.atan2(
    Math.sin(mapBase.yaw - odomBase.yaw),
    Math.cos(mapBase.yaw - odomBase.yaw)
  );
  return {
    x: mapBase.x - Math.cos(yaw) * odomBase.x + Math.sin(yaw) * odomBase.y,
    y: mapBase.y - Math.sin(yaw) * odomBase.x - Math.cos(yaw) * odomBase.y,
    yaw,
  };
}
