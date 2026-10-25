export type ExecutionSettings = {cell_m: number; start_mode: "at_entry" | "outside_a6"; outside_clearance_m: number; exit_clearance_m: number; approach_offset_x_m?: number; approach_offset_y_m?: number; approach_speed_mps?: number; approach_tolerance_m?: number};
export const APPROACH_DEFAULT_SPEED_MPS = .75;
export const APPROACH_DEFAULT_TOLERANCE_M = .10;
export const DEFAULT_EXECUTION_SETTINGS: ExecutionSettings = {cell_m: .954, start_mode: "outside_a6", outside_clearance_m: .45, exit_clearance_m: 0, approach_offset_x_m:0, approach_offset_y_m:0, approach_speed_mps:APPROACH_DEFAULT_SPEED_MPS, approach_tolerance_m:APPROACH_DEFAULT_TOLERANCE_M};
export const EXECUTION_SETTINGS_KEY = "lawengwanla-mainprogram-settings-v2";
export function validExecutionSettings(value: unknown): value is ExecutionSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as ExecutionSettings;
  if (![s.approach_offset_x_m,s.approach_offset_y_m].every(v=>v===undefined || typeof v==="number" && Number.isFinite(v) && v>=-.5 && v<=.5)) return false;
  if (s.approach_speed_mps !== undefined && !(typeof s.approach_speed_mps === "number" && Number.isFinite(s.approach_speed_mps) && s.approach_speed_mps >= .01 && s.approach_speed_mps <= 9999)) return false;
  if (s.approach_tolerance_m !== undefined && !(typeof s.approach_tolerance_m === "number" && Number.isFinite(s.approach_tolerance_m) && s.approach_tolerance_m >= .001 && s.approach_tolerance_m <= .4)) return false;
  return [s.cell_m,s.outside_clearance_m,s.exit_clearance_m].every(v => typeof v === "number" && Number.isFinite(v)) &&
    s.cell_m >= .05 && s.cell_m <= 2 && s.outside_clearance_m >= 0 && s.outside_clearance_m <= 2 &&
    s.exit_clearance_m >= 0 && s.exit_clearance_m <= 2 && ["at_entry","outside_a6"].includes(s.start_mode) &&
    (s.start_mode !== "outside_a6" || s.outside_clearance_m >= .05);
}
