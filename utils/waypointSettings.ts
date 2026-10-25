import { cellKey, isCell, MazeCell } from "./mazeRoute";

export const WAYPOINT_SETTINGS_KEY = "lawengwanla-waypoint-settings-v1";
export type WaypointSettings = {
  speed_mps: number;
  angular_speed_radps?: number;
  position_tolerance_m: number;
  heading_deg: number | null;
  heading_tolerance_deg: number;
  distance_offset_m?: number;
  distance_offset_axis?: "travel" | "x" | "y";
  distance_offset_x_m?: number;
  distance_offset_y_m?: number;
  stop_here?: boolean;
};
export type WaypointSettingsMap = Record<string, WaypointSettings>;
export const DEFAULT_WAYPOINT_SETTINGS: WaypointSettings = {
  speed_mps: 0.3,
  angular_speed_radps: 1,
  position_tolerance_m: 0.02,
  heading_deg: null, // Inherit the mission's fixed heading; never follow travel direction.
  heading_tolerance_deg: 3,
  distance_offset_m: 0,
  distance_offset_axis: "travel",
  stop_here: false,
};
export const WAYPOINT_LIMITS = {
  speed_mps: [0.01, 3.40282e38],
  position_tolerance_m: [0.001, 0.4],
  heading_deg: [-180, 360],
  heading_tolerance_deg: [0.1, 30],
  distance_offset_m: [-0.5, 0.5],
} as const;

export function validWaypointSettings(
  value: unknown
): value is WaypointSettings {
  if (!value || typeof value !== "object") return false;
  const data = value as WaypointSettings;
  if(data.angular_speed_radps!==undefined && (!Number.isFinite(data.angular_speed_radps) || data.angular_speed_radps<.01 || data.angular_speed_radps>5))return false;
  if (![data.distance_offset_x_m,data.distance_offset_y_m].every(v=>v===undefined || typeof v==="number" && Number.isFinite(v) && v>=-.5 && v<=.5)) return false;
  if (data.stop_here!==undefined && typeof data.stop_here!=="boolean") return false;
  if (data.distance_offset_axis!==undefined && !["travel","x","y"].includes(data.distance_offset_axis)) return false;
  return Object.entries(WAYPOINT_LIMITS).every(([name, [min, max]]) => {
    const v = data[name as keyof WaypointSettings];
    return (
      (name === "heading_deg" && v === null) ||
      (name === "distance_offset_m" && v === undefined) ||
      (typeof v === "number" && Number.isFinite(v) && v >= min && v <= max)
    );
  });
}
export const settingsForCell = (
  settings: WaypointSettingsMap,
  cell: MazeCell
): WaypointSettings => ({...DEFAULT_WAYPOINT_SETTINGS, ...settings[cellKey(cell)]});

export function restoreWaypointSettings(value: unknown, route: MazeCell[] = []): WaypointSettingsMap {
  const result: WaypointSettingsMap = {};
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  Object.entries(value).forEach(([key, setting]) => {
    const parts = key.split(",").map(Number);
    if (
      parts.length === 2 &&
      isCell({ row: parts[0], col: parts[1] }) &&
      validWaypointSettings(setting)
    )
      result[key] = {
        speed_mps: setting.speed_mps,
        angular_speed_radps: setting.angular_speed_radps ?? 1,
        position_tolerance_m: setting.position_tolerance_m,
        heading_deg: setting.heading_deg,
        heading_tolerance_deg: setting.heading_tolerance_deg,
        distance_offset_m: setting.distance_offset_m ?? 0,
        distance_offset_axis: setting.distance_offset_axis ?? "travel",
        stop_here: setting.stop_here ?? false,
        ...(setting.distance_offset_x_m!==undefined || setting.distance_offset_y_m!==undefined ? {
          distance_offset_x_m:setting.distance_offset_x_m ?? 0,
          distance_offset_y_m:setting.distance_offset_y_m ?? 0,
        } : {}),
      };
  });
  // Preserve the existing 20 cm C8 correction as an editable value once.
  if (route.length===3 && route.every((cell,index)=>cell.row===7 && cell.col===index)) {
    const old = (value as Record<string, WaypointSettings>)["7,2"];
    if (!old || old.distance_offset_m===undefined)
      result["7,2"]={...settingsForCell(result,{row:7,col:2}),distance_offset_m:.20};
  }
  return result;
}

// Offsets extend/shorten the incoming leg. Carry the translation forward so
// the following leg never pulls back to undo a correction.
export function waypointOffset(config: WaypointSettings, dx: number, dy: number) {
  if(config.distance_offset_x_m!==undefined || config.distance_offset_y_m!==undefined)
    return {x:config.distance_offset_x_m ?? 0,y:config.distance_offset_y_m ?? 0};
  const offset=config.distance_offset_m ?? 0;
  return {x:(config.distance_offset_axis==="x" ? 1 : config.distance_offset_axis==="y" ? 0 : dx)*offset,
    y:(config.distance_offset_axis==="y" ? 1 : config.distance_offset_axis==="x" ? 0 : dy)*offset};
}

export function correctedWaypointPositions(route: MazeCell[], settings: WaypointSettingsMap, cellM: number, initialX=0,initialY=0) {
  let offsetX=initialX,offsetY=initialY;
  return route.map((cell,index)=>{
    const previous=route[index-1];
    const dx=previous ? cell.col-previous.col : 1;
    const dy=previous ? cell.row-previous.row : 0;
    const offset=waypointOffset(settingsForCell(settings,cell),dx,dy);
    offsetX+=offset.x;offsetY+=offset.y;
    return {x:(cell.col+.5)*cellM+offsetX,y:(cell.row+.5)*cellM+offsetY};
  });
}

export function distanceOffsetsValid(route: MazeCell[], settings: WaypointSettingsMap, cellM: number, startMode: string, clearance: number) {
  return route.every((cell,index)=>{
    const config=settingsForCell(settings,cell);
    const distance=index ? cellM : startMode==="outside_a6" ? clearance+cellM/2 : 0;
    const previous=route[index-1],dx=previous ? cell.col-previous.col : 1,dy=previous ? cell.row-previous.row : 0;
    const offset=waypointOffset(config,dx,dy),magnitude=Math.hypot(offset.x,offset.y);
    return Number.isFinite(magnitude) && (!magnitude || (distance ? distance+dx*offset.x+dy*offset.y>=.01 : magnitude>=.01));
  });
}

export function executionRoute(route: MazeCell[], settings: WaypointSettingsMap) {
  const end=route.findIndex(cell=>settingsForCell(settings,cell).stop_here);
  return end<0 ? route : route.slice(0,end+1);
}
export function routeSettingsValid(route: MazeCell[], settings: unknown) {
  if (settings === undefined) return true; // Existing drafts use explicit defaults.
  if (!settings || typeof settings !== "object" || Array.isArray(settings))
    return false;
  return route.every((cell) => {
    const value = (settings as Record<string, unknown>)[cellKey(cell)];
    return value === undefined || validWaypointSettings(value);
  });
}
