import { adjacent, cellKey, ENTRY_CELL, MazeCell, sameCell } from "./mazeRoute";

export function routeAfterDeletion(route: MazeCell[], keys: string[]) {
  const selected = new Set(keys);
  const removed = route.filter((cell) => selected.has(cellKey(cell)));
  const remaining = route.filter((cell) => !selected.has(cellKey(cell)));
  const error = !removed.length
    ? "ยังไม่ได้เลือกรายการที่จะลบ"
    : remaining.length && !sameCell(remaining[0], ENTRY_CELL)
    ? "ลบแล้วช่องแรกไม่ใช่ A8 กรุณาคงช่องแรกไว้ หรือเลือกถึงท้ายเพื่อล้างเส้นทาง"
    : remaining.some((cell, i) => i > 0 && !adjacent(remaining[i - 1], cell))
    ? "ลบแล้วเส้นทางจะขาด: ต้องคงช่องติดกัน หรือลบตั้งแต่รายการที่เลือกถึงท้ายแล้ววางใหม่"
    : "";
  return { remaining, removed, error };
}
