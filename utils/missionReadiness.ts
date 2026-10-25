import {
  adjacent,
  isCell,
  MAX_ROUTE_CELLS,
  MazeCell,
  ENTRY_CELL,
  sameCell,
} from "./mazeRoute";
import { RACK_COLORS, RackCell, RackSelection } from "./rackMission";
import { routeSettingsValid } from "./waypointSettings";

export type MissionCheck = {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
  section: string;
};
const validPick = (cell: unknown): cell is RackCell => {
  if (!cell || typeof cell !== "object") return false;
  const { row, col } = cell as RackCell;
  return (
    Number.isInteger(row) &&
    Number.isInteger(col) &&
    row >= 0 &&
    row < 3 &&
    col >= 0 &&
    col < 3
  );
};

export function missionChecks(
  routeValue: unknown,
  rackValue: unknown,
  waypointSettings?: unknown
): MissionCheck[] {
  const route: unknown[] = Array.isArray(routeValue) ? routeValue : [];
  const validCells = route.every(isCell);
  const continuous =
    validCells &&
    route.every(
      (cell, index) =>
        index === 0 || adjacent(route[index - 1] as MazeCell, cell as MazeCell)
    );
  const unique =
    validCells &&
    new Set(
      route.map((cell) => `${(cell as MazeCell).row},${(cell as MazeCell).col}`)
    ).size === route.length;
  const correctEntry = isCell(route[0]) && sameCell(route[0], ENTRY_CELL);
  const rack =
    rackValue && typeof rackValue === "object"
      ? (rackValue as Partial<RackSelection>)
      : {};
  const picks: unknown[] = Array.isArray(rack.picks) ? rack.picks : [];
  const picksValid =
    picks.length >= 1 &&
    picks.length <= 3 &&
    picks.every(validPick) &&
    new Set(picks.map((cell) => (cell as RackCell).row)).size === picks.length;
  const color = RACK_COLORS.find((item) => item.id === rack.color);
  return [
    {
      id: "waypoint-settings",
      label: "ค่าความเร็วและความคลาดเคลื่อนรายช่องถูกต้อง",
      passed:
        validCells &&
        route.length > 0 &&
        routeSettingsValid(route as MazeCell[], waypointSettings),
      detail:
        "หัวหุ่นคงทิศเดิม · ROS ใช้ความเร็วและค่าคลาดเคลื่อนรายช่อง",
      section: "maze-map",
    },
    {
      id: "route",
      label: "มีเส้นทางเริ่ม A8 และต่อเนื่อง",
      passed:
        route.length > 0 && route.length <= MAX_ROUTE_CELLS &&
        continuous &&
        unique &&
        correctEntry,
      detail:
        !validCells || !continuous || !unique
          ? "พบช่องไม่ถูกต้อง ข้ามช่อง หรือใช้ช่องซ้ำ"
          : !correctEntry
          ? "เริ่มนอกสนามซ้าย A6 แล้วเข้าช่องแรก A8"
          : `เลือกแล้ว ${route.length} ช่อง · หยุดที่ช่องสุดท้ายที่เลือก`,
      section: "maze-map",
    },
    {
      id: "picks",
      label: "เลือกช่องหยิบบล็อก 1–3 ช่อง",
      passed: picksValid,
      detail: picksValid
        ? `เลือกแล้ว ${picks.length} ช่อง`
        : "เลือกช่องหยิบชั้นละหนึ่งช่อง สูงสุด 3 ชั้น",
      section: "rack-pick-controls",
    },
    {
      id: "color",
      label: "เลือกสีบล็อก",
      passed: !!color,
      detail: color
        ? `สี${color.label} · ล็อกตู้วางคอลัมน์ ${color.column}`
        : "เลือกน้ำเงิน เขียว หรือแดง",
      section: "rack-pick-controls",
    },
    {
      id: "plate",
      label: "เลือกแผ่นเหล็ก 1 แผ่น",
      passed:
        Number.isInteger(rack.plate) && rack.plate! >= 1 && rack.plate! <= 3,
      detail:
        Number.isInteger(rack.plate) && rack.plate! >= 1 && rack.plate! <= 3
          ? `แผ่นที่ ${rack.plate}`
          : "เลือกแผ่นที่ 1, 2 หรือ 3",
      section: "rack-pick-controls",
    },
  ];
}
