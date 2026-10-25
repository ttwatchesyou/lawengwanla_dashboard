import { MazeCell, sameCell } from "./mazeRoute";
import type { WaypointSettingsMap } from "./waypointSettings";

export type MazePreset = {
  id: string;
  name: string;
  imagePosition: string;
  route: MazeCell[];
  waypointSettings?: WaypointSettingsMap;
};
const parse = (labels: string): MazeCell[] =>
  labels.split(" ").map((label) => ({
    col: label.charCodeAt(0) - 65,
    row: Number(label.slice(1)) - 1,
  }));

// Exact named-cell snapshot from the latest executed A8..F5 configuration.
const testedPattern1Settings: WaypointSettingsMap = {
  "7,0": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.1,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "7,1": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.1,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "7,2": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.1,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0.2,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "6,2": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.2,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "5,2": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.2,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "4,2": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.2,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0.2,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "4,3": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.1,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "4,4": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.1,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0,
    "distance_offset_axis": "travel",
    "stop_here": false
  },
  "4,5": {
    "speed_mps": 0.75,
    "position_tolerance_m": 0.1,
    "heading_deg": 90,
    "heading_tolerance_deg": 3,
    "distance_offset_m": 0.2,
    "distance_offset_axis": "travel",
    "stop_here": false
  }
};

export const PATTERN_1_MIGRATION_KEY = "lawengwanla-pattern1-named-settings-v1";
export function pattern1WaypointSettings(route: MazeCell[]): WaypointSettingsMap {
  return Object.fromEntries(route.flatMap(cell=>{const key=`${cell.row},${cell.col}`;return testedPattern1Settings[key] ? [[key,{...testedPattern1Settings[key]}]] : [];}));
}

// Mapped from the operator's latest A8..F5 run: 0.75 m/s throughout,
// 10 cm horizontal / 20 cm longitudinal tolerance, +20 cm at each leg end.
// Opposite directions use the same candidate settings, pending floor trials.
function inferredPattern1Settings(route: MazeCell[]): WaypointSettingsMap {
  return Object.fromEntries(route.map((cell,index)=>{
    const previous=route[index-1],next=route[index+1];
    const dx=previous ? cell.col-previous.col : 1;
    const dy=previous ? cell.row-previous.row : 0;
    const legEnd=!next || next.col-cell.col!==dx || next.row-cell.row!==dy;
    return [`${cell.row},${cell.col}`,{
      speed_mps:.75,
      position_tolerance_m:dy ? .20 : .10,
      heading_deg:90,
      heading_tolerance_deg:3,
      distance_offset_m:index>0 && legEnd ? .20 : 0,
    }];
  }));
}


// One-time cleanup of the inferred settings shipped before the user clarified copying by cell name.
export function removeInferredPattern1Settings(saved: WaypointSettingsMap): WaypointSettingsMap {
  const result={...saved},inferred=inferredPattern1Settings(MAZE_PRESETS[0].route);
  for(const [key,old] of Object.entries(inferred)){
    if(testedPattern1Settings[key] || !result[key]) continue;
    const current=result[key];
    if(current.distance_offset_x_m===undefined && current.distance_offset_y_m===undefined && current.speed_mps===old.speed_mps && current.position_tolerance_m===old.position_tolerance_m && current.heading_deg===old.heading_deg && current.heading_tolerance_deg===old.heading_tolerance_deg && (current.distance_offset_m ?? 0)===old.distance_offset_m && (!current.distance_offset_axis || current.distance_offset_axis==="travel") && !current.stop_here) delete result[key];
  }
  return result;
}

// Transcribed from the numbered green paths in the user's six-pattern image.
// Order: top-left to top-right, then bottom-left to bottom-right.
export const MAZE_PRESETS: MazePreset[] = [
  {
    id: "pattern-1",
    name: "แบบที่ 1",
    imagePosition: "บนซ้าย",
    route: parse(
      "A8 B8 C8 C7 C6 C5 D5 E5 F5 F6 F7 F8 G8 H8 H7 H6 H5 H4 H3 G3 F3 E3 E2 D2 C2 C3 B3 A3 A2 A1 B1 C1 D1 E1 F1 G1 H1"
    ),
  },
  {
    id: "pattern-2",
    name: "แบบที่ 2",
    imagePosition: "บนกลาง",
    route: parse(
      "A8 B8 C8 C7 C6 B6 A6 A5 A4 A3 A2 B2 C2 D2 E2 E3 E4 E5 E6 E7 F7 F6 F5 F4 G4 G5 G6 G7 G8 H8 H7 H6 H5 H4 H3 H2 H1"
    ),
  },
  {
    id: "pattern-3",
    name: "แบบที่ 3",
    imagePosition: "บนขวา",
    route: parse(
      "A8 B8 C8 D8 E8 E7 E6 E5 D5 C5 B5 B4 B3 B2 C2 D2 D3 D4 E4 F4 F5 F6 F7 G7 G8 H8 H7 H6 H5 G5 G4 G3 F3 F2 G2 H2 H1"
    ),
  },
  {
    id: "pattern-4",
    name: "แบบที่ 4",
    imagePosition: "ล่างซ้าย",
    route: parse(
      "A8 B8 C8 C7 C6 D6 D7 D8 E8 F8 G8 G7 G6 G5 H5 H4 H3 G3 F3 E3 D3 D4 C4 B4 B3 B2 A2 A1 B1 C1 C2 D2 E2 E1 F1 G1 H1"
    ),
  },
  {
    id: "pattern-5",
    name: "แบบที่ 5",
    imagePosition: "ล่างกลาง",
    route: parse(
      "A8 B8 C8 C7 D7 E7 E8 F8 F7 F6 G6 G7 H7 H6 H5 H4 G4 F4 E4 E5 D5 C5 B5 B4 B3 C3 C2 B2 B1 C1 D1 E1 E2 F2 F1 G1 H1"
    ),
  },
  {
    id: "pattern-6",
    name: "แบบที่ 6",
    imagePosition: "ล่างขวา",
    route: parse(
      "A8 B8 C8 C7 C6 B6 A6 A5 A4 A3 A2 A1 B1 B2 B3 C3 C4 C5 D5 D6 D7 E7 F7 F6 F5 F4 F3 G3 G4 G5 G6 H6 H5 H4 H3 H2 H1"
    ),
  },
];

MAZE_PRESETS[0].waypointSettings=pattern1WaypointSettings(MAZE_PRESETS[0].route);

export function matchingPreset(route: MazeCell[]) {
  return MAZE_PRESETS.find(
    (preset) =>
      preset.route.length === route.length &&
      preset.route.every((cell, index) => sameCell(cell, route[index]))
  );
}
