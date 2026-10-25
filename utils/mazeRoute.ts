export const GRID_SIZE = 8;
export const CELL_METERS = 0.954;
export const MAX_ROUTE_CELLS = 37;
export const ROUTE_STORAGE_KEY = "lawengwanla-maze-route-v1";
export type MazeCell = { row: number; col: number };
export const ENTRY_CELL: MazeCell = { row: 7, col: 0 }; // A8, after the external approach.
export const START_ALIGNMENT_CELL: MazeCell = { row: 5, col: 0 }; // Outside, left of A6.
export const isExitCell = (cell: MazeCell) => cell.col === GRID_SIZE - 1;
export const cellKey = ({ row, col }: MazeCell) => `${row},${col}`;
export const cellLabel = ({ row, col }: MazeCell) =>
  `${String.fromCharCode(65 + col)}${row + 1}`;
export const sameCell = (a: MazeCell, b: MazeCell) =>
  a.row === b.row && a.col === b.col;
export const adjacent = (a: MazeCell, b: MazeCell) =>
  Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;

export function isCell(value: unknown): value is MazeCell {
  if (!value || typeof value !== "object") return false;
  const { row, col } = value as MazeCell;
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < GRID_SIZE &&
    col >= 0 &&
    col < GRID_SIZE
  );
}

// Retain only a continuous, unique prefix from drafts made with the old planner.
export function restoreRoute(value: unknown): MazeCell[] {
  if (!Array.isArray(value)) return [];
  const result: MazeCell[] = [];
  for (const cell of value) {
    if (
      result.length === MAX_ROUTE_CELLS ||
      !isCell(cell) ||
      result.some((item) => sameCell(item, cell)) ||
      (result.length > 0 && !adjacent(result[result.length - 1], cell))
    )
      break;
    result.push({ row: cell.row, col: cell.col });
  }
  return result;
}

export function nextCells(route: MazeCell[]): MazeCell[] {
  if (!route.length) return [{ ...ENTRY_CELL }];
  if (route.length >= MAX_ROUTE_CELLS) return [];
  const end = route[route.length - 1];
  return [
    { row: end.row + 1, col: end.col },
    { row: end.row, col: end.col + 1 },
    { row: end.row - 1, col: end.col },
    { row: end.row, col: end.col - 1 },
  ].filter(
    (cell) => isCell(cell) && !route.some((item) => sameCell(item, cell))
  );
}

export function routeSegments(route: MazeCell[]) {
  return route.slice(1).map((to, index) => {
    const from = route[index];
    const dx = to.col - from.col,
      dy = to.row - from.row;
    return {
      from,
      to,
      distance: Math.hypot(dx, dy) * CELL_METERS,
      heading: Math.atan2(dy, dx),
      direction: dx > 0 ? "ขวา" : dx < 0 ? "ซ้าย" : dy > 0 ? "ขึ้น" : "ลง",
      arrow: dx > 0 ? "→" : dx < 0 ? "←" : dy > 0 ? "↑" : "↓",
      valid: adjacent(from, to),
    };
  });
}
