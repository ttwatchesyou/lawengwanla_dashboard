export const RACK_STORAGE_KEY = "lawengwanla-rack-mission-v1";
export const RACK_COLORS = [
  { id: "blue", label: "น้ำเงิน", hex: "#4c8dff", column: 1 },
  { id: "green", label: "เขียว", hex: "#54c99b", column: 2 },
  { id: "red", label: "แดง", hex: "#f1717a", column: 3 },
] as const;

export type RackColor = (typeof RACK_COLORS)[number]["id"];
export type RackCell = { row: number; col: number };
export type RackSelection = {
  plate: number | null;
  color: RackColor | null;
  picks: RackCell[];
};
export const emptyRackSelection = (): RackSelection => ({
  plate: null,
  color: null,
  picks: [],
});
export const rackCellLabel = ({ row, col }: RackCell) =>
  `${"ABC"[col]}${row + 1}`;
export const sameRackCell = (a: RackCell, b: RackCell) =>
  a.row === b.row && a.col === b.col;

export function restoreRackSelection(value: unknown): RackSelection {
  const restored = emptyRackSelection();
  if (!value || typeof value !== "object") return restored;
  const data = value as Partial<RackSelection>;
  if (Number.isInteger(data.plate) && data.plate! >= 1 && data.plate! <= 3)
    restored.plate = data.plate!;
  if (RACK_COLORS.some((color) => color.id === data.color))
    restored.color = data.color!;
  if (Array.isArray(data.picks)) {
    for (const cell of data.picks) {
      if (restored.picks.length === 3) break;
      if (
        cell &&
        Number.isInteger(cell.row) &&
        Number.isInteger(cell.col) &&
        cell.row >= 0 &&
        cell.row < 3 &&
        cell.col >= 0 &&
        cell.col < 3 &&
        !restored.picks.some((item) => sameRackCell(item, cell))
      ) {
        restored.picks.push({ row: cell.row, col: cell.col });
      }
    }
  }
  return restored;
}

export function rackMission(selection: RackSelection) {
  const color = RACK_COLORS.find((item) => item.id === selection.color);
  const configured =
    selection.plate !== null &&
    !!color &&
    selection.picks.length > 0 &&
    selection.picks.length <= 3;
  return {
    status: configured ? "configured" : "draft",
    plate_id: selection.plate,
    block_color: selection.color,
    source_cabinet: {
      rows: 3,
      columns: 3,
      picks: selection.picks.map((cell, index) => ({
        order: index + 1,
        row: cell.row + 1,
        column: cell.col + 1,
      })),
    },
    destination_cabinet: {
      column_colors_left_to_right: ["blue", "green", "red"],
      selected_column: color?.column ?? null,
      row_order: "bottom_to_top",
      placements: color
        ? selection.picks.map((_, index) => ({
            order: index + 1,
            row: index + 1,
            column: color.column,
          }))
        : [],
    },
  };
}
