import { RackCell, RackSelection, sameRackCell } from "./rackMission";

export type PickSetup = { locked: boolean; ready: boolean; revision: number; targets: Record<string, number> };
export const pickupTargets = (picks: RackCell[]) => Object.fromEntries(picks.map(cell => [`floor${cell.row + 1}`, cell.col + 1]));
export const pickupKey = (picks: RackCell[]) => JSON.stringify(Object.entries(pickupTargets(picks)).sort());
export function selectPickupCell(selection: RackSelection, cell: RackCell): RackSelection {
  const existing = selection.picks.findIndex(pick => pick.row === cell.row);
  const picks = [...selection.picks];
  if (existing >= 0 && sameRackCell(picks[existing], cell)) picks.splice(existing, 1);
  else if (existing >= 0) picks[existing] = cell;
  else if (picks.length < 3) picks.push(cell);
  return { ...selection, picks };
}
export function parsePickSetup(value: unknown): PickSetup | null {
  if (!value || typeof value !== "object") return null;
  const setup = value as PickSetup;
  if (typeof setup.locked !== "boolean" || typeof setup.ready !== "boolean" ||
      !Number.isSafeInteger(setup.revision) || setup.revision < 0 || !setup.targets || typeof setup.targets !== "object" || Array.isArray(setup.targets) ||
      Object.entries(setup.targets).some(([key, target]) => !["floor1", "floor2", "floor3"].includes(key) || ![1, 2, 3].includes(target))) return null;
  return setup;
}
export const pickupMatches = (setup: PickSetup | null, picks: RackCell[]) => !!setup && picks.length > 0 &&
  new Set(picks.map(cell => cell.row)).size === picks.length && JSON.stringify(Object.entries(setup.targets).sort()) === pickupKey(picks);
