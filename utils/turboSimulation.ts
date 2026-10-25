import { MazeCell, cellLabel, sameCell, ENTRY_CELL } from "./mazeRoute";
import { ExecutionSettings } from "./mainprogramSettings";
import {
  correctedWaypointPositions,
  executionRoute,
  settingsForCell,
  WaypointSettingsMap,
} from "./waypointSettings";
import {
  FIXED_HEADING_RAD,
  makeSimulationPlan,
  SimulationPlan,
  translationLabel,
} from "./robotSimulation";
import { TurboFrame, SILENT_TURBO, FINISHED_TURBO } from "./turboAudio";

export function makeTurboSimulation(
  route: MazeCell[],
  settings: WaypointSettingsMap,
  config: ExecutionSettings
): SimulationPlan {
  const valid =
    makeSimulationPlan(route, settings).valid && sameCell(route[0], ENTRY_CELL);
  const cells = executionRoute(route, settings),
    outside = config.start_mode === "outside_a6";
  const positions = correctedWaypointPositions(
    cells,
    settings,
    config.cell_m,
    outside ? config.approach_offset_x_m ?? 0 : 0,
    outside ? config.approach_offset_y_m ?? 0 : 0
  );
  const points = cells.map((cell, i) => ({
    ...positions[i],
    label: cellLabel(cell),
    cell,
  }));
  const initial = {
    x: outside ? -config.outside_clearance_m : config.cell_m / 2,
    y: 7.5 * config.cell_m - (outside ? 2 : 0),
    heading: FIXED_HEADING_RAD,
  };
  const plan: SimulationPlan = {
    points: [],
    legs: [],
    initial,
    duration: 0,
    valid,
  };
  if (!valid) return plan;
  const targets: { x: number; y: number; label: string; speed: number }[] = [];
  if (outside)
    targets.push({
      x: initial.x + (config.approach_offset_x_m ?? 0),
      y: 7.5 * config.cell_m + (config.approach_offset_y_m ?? 0),
      label: "แนวเข้า A8",
      speed: config.approach_speed_mps ?? 0.75,
    });
  points.forEach((point) =>
    targets.push({
      ...point,
      speed: settingsForCell(settings, point.cell).speed_mps,
    })
  );
  const last = points[points.length - 1];
  if (
    last &&
    last.cell.col === 7 &&
    config.exit_clearance_m > 0 &&
    !settingsForCell(settings, last.cell).stop_here
  )
    targets.push({
      ...last,
      x: last.x + 0.5 * config.cell_m + config.exit_clearance_m,
      label: "FINISH",
      speed: targets[targets.length - 1].speed,
    });
  plan.points = [{ ...initial, label: "START" }, ...targets];
  let from = initial;
  for (const target of targets) {
    const distance = Math.hypot(target.x - from.x, target.y - from.y);
    if (distance < 0.000001) continue;
    const to = { x: target.x, y: target.y, heading: FIXED_HEADING_RAD };
    const duration = distance / target.speed;
    plan.legs.push({
      from,
      to,
      start: plan.duration,
      duration,
      kind: "move",
      label: target.label,
      motion: translationLabel(to.x - from.x, to.y - from.y),
    });
    plan.duration += duration;
    from = to;
  }
  return plan;
}

export function simulationTurboFrame(
  plan: SimulationPlan,
  time: number
): TurboFrame {
  const index = plan.legs.findIndex((leg) => time < leg.start + leg.duration);
  if (!plan.valid) return SILENT_TURBO;
  if (index < 0) return FINISHED_TURBO;
  const leg = plan.legs[index];
  const fraction = Math.max(0, Math.min(1, (time - leg.start) / leg.duration));
  let distance =
    Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) * (1 - fraction);
  // A straight run spools continuously across cells and eases off at corners.
  for (let i = index; i + 1 < plan.legs.length; i++) {
    const a = plan.legs[i],
      b = plan.legs[i + 1];
    const dx = a.to.x - a.from.x,
      dy = a.to.y - a.from.y;
    const nx = b.to.x - b.from.x,
      ny = b.to.y - b.from.y;
    if (
      (dx * nx + dy * ny) / (Math.hypot(dx, dy) * Math.hypot(nx, ny)) <
      0.999999
    )
      break;
    distance += Math.hypot(nx, ny);
  }
  return {
    moving: true,
    distance,
    speed:
      Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) / leg.duration,
  };
}
