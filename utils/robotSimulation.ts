import {
  adjacent,
  CELL_METERS,
  cellLabel,
  ENTRY_CELL,
  GRID_SIZE,
  isExitCell,
  isCell,
  MAX_ROUTE_CELLS,
  MazeCell,
  sameCell,
} from "./mazeRoute";
import {
  settingsForCell,
  correctedWaypointPositions,
  executionRoute,
  WaypointSettingsMap,
  validWaypointSettings,
} from "./waypointSettings";

// Measured outer envelope supplied by the team; details are visual approximations.
export const ROBOT_PROFILE = {
  width_m: 0.66,
  depth_m: 0.66,
  height_m: 1,
  drive: "mecanum",
  model_source: "reference_photos",
  model_is_engineering_cad: false,
  model_forward_offset_deg: 180,
} as const;

export type RobotPose = { x: number; y: number; heading: number };
// Initial front points up the maze. Mecanum translation never changes this yaw.
// Map drawing uses +Y/up = 90 degrees. Robot heading starts at boot-relative 0.
export const ROBOT_INITIAL_HEADING_DEG = 0;
export const FIXED_HEADING_DEG = 90;
export const FIXED_HEADING_RAD = (FIXED_HEADING_DEG * Math.PI) / 180;
export type SimulationPoint = {
  x: number;
  y: number;
  label: string;
  cell?: MazeCell;
};
export type SimulationLeg = {
  from: RobotPose;
  to: RobotPose;
  start: number;
  duration: number;
  kind: "turn" | "move";
  label: string;
  motion: string;
};
export type SimulationPlan = {
  points: SimulationPoint[];
  legs: SimulationLeg[];
  duration: number;
  initial: RobotPose;
  valid: boolean;
};
export const shortestTurn = (angle: number) =>
  Math.atan2(Math.sin(angle), Math.cos(angle));
export function translationLabel(
  dx: number,
  dy: number,
  heading = FIXED_HEADING_RAD
) {
  const forward = dx * Math.cos(heading) + dy * Math.sin(heading);
  const right = dx * Math.sin(heading) - dy * Math.cos(heading);
  return Math.abs(forward) >= Math.abs(right)
    ? forward >= 0
      ? "เดินหน้า"
      : "ถอยหลัง"
    : right >= 0
    ? "สไลด์ขวา"
    : "สไลด์ซ้าย";
}

export function makeSimulationPlan(
  route: MazeCell[],
  settings: WaypointSettingsMap = {}
): SimulationPlan {
  route=executionRoute(route,settings);
  const valid =
    route.length > 0 &&
    route.length <= MAX_ROUTE_CELLS &&
    new Set(route.map((cell) => `${cell.col},${cell.row}`)).size ===
      route.length &&
    route.every(
      (cell, index) =>
        isCell(cell) &&
        validWaypointSettings(settingsForCell(settings, cell)) &&
        (index === 0 || adjacent(route[index - 1], cell))
    );
  const corrected=correctedWaypointPositions(route,settings,CELL_METERS);
  const points: SimulationPoint[] = route.map((cell,index) => ({
    x: corrected[index].x,
    y: corrected[index].y,
    label: cellLabel(cell),
    cell,
  }));
  // Illustrative outside approach only, NOT surveyed docking/navigation coordinates.
  const outsideX = -ROBOT_PROFILE.width_m / 2 - 0.15;
  if (route.length && sameCell(route[0], ENTRY_CELL)) {
    points.unshift(
      { x: outsideX, y: 5.5 * CELL_METERS, label: "START · ซ้าย A6" },
      { x: outsideX, y: 7.5 * CELL_METERS, label: "แนวเข้า A8" }
    );
  }
  const end = route[route.length - 1];
  if (route.length === MAX_ROUTE_CELLS && end && isExitCell(end) && !settingsForCell(settings,end).stop_here) {
    const final=corrected[corrected.length-1];
    points.push({
      x: GRID_SIZE * CELL_METERS + ROBOT_PROFILE.width_m / 2 + 0.15 + final.x-(end.col+.5)*CELL_METERS,
      y: final.y,
      label: "FINISH",
    });
  }
  const initial: RobotPose = {
    x: points[0]?.x ?? outsideX,
    y: points[0]?.y ?? 5.5 * CELL_METERS,
    heading: FIXED_HEADING_RAD,
  };
  const legs: SimulationLeg[] = [];
  let pose = initial;
  let duration = 0;
  if (valid)
    for (const point of points.slice(1)) {
      const config = point.cell ? settingsForCell(settings, point.cell) : null;
      // Old per-cell headings are retained in saved drafts, not applied here.
      const next = { x: point.x, y: point.y, heading: pose.heading };
      const seconds =
        Math.hypot(next.x - pose.x, next.y - pose.y) /
        (config?.speed_mps ?? 0.3);
      legs.push({
        from: pose,
        to: next,
        start: duration,
        duration: seconds,
        kind: "move",
        label: point.label,
        motion: translationLabel(next.x - pose.x, next.y - pose.y),
      });
      duration += seconds;
      pose = next;
    }
  return { points, legs, duration, initial, valid };
}

export function sampleSimulation(plan: SimulationPlan, time: number) {
  const t = Math.max(0, Math.min(plan.duration, time));
  const leg =
    plan.legs.find((item) => t < item.start + item.duration) ??
    plan.legs[plan.legs.length - 1];
  if (!leg)
    return {
      pose: plan.initial,
      label: "รอเส้นทาง",
      moving: false,
      done: false,
      motion: "หยุด",
    };
  const fraction = Math.max(0, Math.min(1, (t - leg.start) / leg.duration));
  return {
    pose: {
      x: leg.from.x + (leg.to.x - leg.from.x) * fraction,
      y: leg.from.y + (leg.to.y - leg.from.y) * fraction,
      heading:
        leg.from.heading + (leg.to.heading - leg.from.heading) * fraction,
    },
    label: t >= plan.duration ? "จบการจำลอง" : leg.label,
    moving: leg.kind === "move" && t < plan.duration,
    done: t >= plan.duration,
    motion: t >= plan.duration ? "หยุด" : leg.motion,
  };
}
