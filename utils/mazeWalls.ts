import {
  CELL_METERS,
  ENTRY_CELL,
  GRID_SIZE,
  isCell,
  isExitCell,
  MAX_ROUTE_CELLS,
  MazeCell,
  sameCell,
} from "./mazeRoute";
import { RobotPose, ROBOT_PROFILE } from "./robotSimulation";

export type Point2 = { x: number; y: number };
export type MazeWall = {
  id: string;
  from: Point2;
  to: Point2;
  source: "field_boundary" | "inferred_corridor";
};
export const PREVIEW_TOF_RANGE_M = 2;

// Reference geometry ONLY: consecutive waypoints make open passages.
// This is not the surveyed wall layout and must never be treated as live ToF.
export function buildPreviewWalls(route: MazeCell[]): MazeWall[] {
  const walls = new Map<string, MazeWall>();
  const add = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    source: MazeWall["source"]
  ) => {
    const id = `${x1},${y1}:${x2},${y2}`;
    if (!walls.has(id))
      walls.set(id, {
        id,
        from: { x: x1 * CELL_METERS, y: y1 * CELL_METERS },
        to: { x: x2 * CELL_METERS, y: y2 * CELL_METERS },
        source,
      });
  };
  const end = route[route.length - 1];
  const exit =
    route.length === MAX_ROUTE_CELLS && end && isExitCell(end) ? end : null;
  for (let i = 0; i < GRID_SIZE; i++) {
    if (i !== ENTRY_CELL.row) add(0, i, 0, i + 1, "field_boundary");
    if (!exit || exit.row !== i)
      add(GRID_SIZE, i, GRID_SIZE, i + 1, "field_boundary");
    add(i, 0, i + 1, 0, "field_boundary");
    add(i, GRID_SIZE, i + 1, GRID_SIZE, "field_boundary");
  }
  route.forEach((cell, index) => {
    if (!isCell(cell)) return;
    const { row: r, col: c } = cell;
    const sides = [
      { next: { row: r, col: c - 1 }, edge: [c, r, c, r + 1] },
      { next: { row: r, col: c + 1 }, edge: [c + 1, r, c + 1, r + 1] },
      { next: { row: r - 1, col: c }, edge: [c, r, c + 1, r] },
      { next: { row: r + 1, col: c }, edge: [c, r + 1, c + 1, r + 1] },
    ];
    sides.forEach(({ next, edge }) => {
      if (!isCell(next)) return; // Outer boundary/entry/exit was handled above.
      if (
        [route[index - 1], route[index + 1]].some((p) => p && sameCell(p, next))
      )
        return;
      add(edge[0], edge[1], edge[2], edge[3], "inferred_corridor");
    });
  });
  return [...walls.values()];
}

export const ROBOT_WALL_DIRECTIONS = [
  { id: "front", label: "หน้า", forward: 1, right: 0 },
  { id: "rear", label: "หลัง", forward: -1, right: 0 },
  { id: "left", label: "ซ้าย", forward: 0, right: -1 },
  { id: "right", label: "ขวา", forward: 0, right: 1 },
] as const;
const cross = (a: Point2, b: Point2) => a.x * b.y - a.y * b.x;
export function previewWallReadings(
  walls: MazeWall[],
  pose: RobotPose,
  range = PREVIEW_TOF_RANGE_M
) {
  return ROBOT_WALL_DIRECTIONS.map((side) => {
    const direction = {
      x:
        side.forward * Math.cos(pose.heading) +
        side.right * Math.sin(pose.heading),
      y:
        side.forward * Math.sin(pose.heading) -
        side.right * Math.cos(pose.heading),
    };
    const half = side.forward
      ? ROBOT_PROFILE.depth_m / 2
      : ROBOT_PROFILE.width_m / 2;
    const origin = {
      x: pose.x + direction.x * half,
      y: pose.y + direction.y * half,
    };
    let distance: number | null = null,
      hit: Point2 | null = null,
      wallId: string | null = null;
    for (const wall of walls) {
      const segment = {
        x: wall.to.x - wall.from.x,
        y: wall.to.y - wall.from.y,
      };
      const denominator = cross(direction, segment);
      if (Math.abs(denominator) < 1e-9) continue;
      const offset = { x: wall.from.x - origin.x, y: wall.from.y - origin.y };
      const t = cross(offset, segment) / denominator,
        u = cross(offset, direction) / denominator;
      if (
        t >= -1e-9 &&
        t <= range &&
        u >= -1e-9 &&
        u <= 1 + 1e-9 &&
        (distance === null || t < distance)
      ) {
        distance = Math.max(0, t);
        hit = {
          x: origin.x + direction.x * distance,
          y: origin.y + direction.y * distance,
        };
        wallId = wall.id;
      }
    }
    return {
      id: side.id,
      label: side.label,
      origin,
      direction,
      distance_m: distance,
      hit,
      wall_id: wallId,
    };
  });
}

export function pointInRobotFrame(point: Point2, pose: RobotPose) {
  const dx = point.x - pose.x,
    dy = point.y - pose.y;
  return {
    right: dx * Math.sin(pose.heading) - dy * Math.cos(pose.heading),
    forward: dx * Math.cos(pose.heading) + dy * Math.sin(pose.heading),
  };
}
