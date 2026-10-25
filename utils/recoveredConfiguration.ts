// Recovered from the kiosk browser storage saved on 2026-10-20 before rollback.
// Apply once per browser and retain a local backup before replacing any value.
export const CONFIG_RECOVERY_KEY = "lawengwanla-config-recovered-20261020-v1";
export const CONFIG_RECOVERY_BACKUP_KEY = "lawengwanla-config-before-recovery-20261020-v1";
export const RECOVERED_BROWSER_CONFIG: Record<string, unknown> = {
  "lawengwanla-maze-route-v1": [
    {
      "row": 7,
      "col": 0
    },
    {
      "row": 7,
      "col": 1
    },
    {
      "row": 7,
      "col": 2
    },
    {
      "row": 6,
      "col": 2
    },
    {
      "row": 5,
      "col": 2
    },
    {
      "row": 4,
      "col": 2
    },
    {
      "row": 4,
      "col": 3
    },
    {
      "row": 4,
      "col": 4
    },
    {
      "row": 4,
      "col": 5
    },
    {
      "row": 5,
      "col": 5
    },
    {
      "row": 6,
      "col": 5
    },
    {
      "row": 7,
      "col": 5
    },
    {
      "row": 7,
      "col": 6
    },
    {
      "row": 7,
      "col": 7
    },
    {
      "row": 6,
      "col": 7
    },
    {
      "row": 5,
      "col": 7
    },
    {
      "row": 4,
      "col": 7
    },
    {
      "row": 3,
      "col": 7
    },
    {
      "row": 2,
      "col": 7
    },
    {
      "row": 2,
      "col": 6
    },
    {
      "row": 2,
      "col": 5
    },
    {
      "row": 2,
      "col": 4
    },
    {
      "row": 1,
      "col": 4
    },
    {
      "row": 1,
      "col": 3
    },
    {
      "row": 1,
      "col": 2
    },
    {
      "row": 2,
      "col": 2
    },
    {
      "row": 2,
      "col": 1
    },
    {
      "row": 2,
      "col": 0
    },
    {
      "row": 1,
      "col": 0
    },
    {
      "row": 0,
      "col": 0
    },
    {
      "row": 0,
      "col": 1
    },
    {
      "row": 0,
      "col": 2
    },
    {
      "row": 0,
      "col": 3
    },
    {
      "row": 0,
      "col": 4
    },
    {
      "row": 0,
      "col": 5
    },
    {
      "row": 0,
      "col": 6
    },
    {
      "row": 0,
      "col": 7
    }
  ],
  "lawengwanla-rack-mission-v1": {
    "plate": 2,
    "color": "green",
    "picks": [
      {
        "row": 2,
        "col": 0
      },
      {
        "row": 1,
        "col": 1
      },
      {
        "row": 0,
        "col": 2
      }
    ]
  },
  "lawengwanla-waypoint-settings-v1": {
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
  },
  "lawengwanla-mainprogram-settings-v2": {
    "cell_m": 0.954,
    "start_mode": "outside_a6",
    "outside_clearance_m": 0.45,
    "exit_clearance_m": 0
  },
  "lawengwanla-pattern1-named-settings-v1": "done"
};

type RecoveryStorage = Pick<Storage, "getItem" | "setItem">;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parse(value: string | null): unknown {
  try { return value === null ? null : JSON.parse(value); }
  catch { return null; }
}

export function restoreRecoveredConfiguration(storage: RecoveryStorage): boolean {
  if (storage.getItem(CONFIG_RECOVERY_KEY) === "done") return false;
  const keys = Object.keys(RECOVERED_BROWSER_CONFIG);
  const before = Object.fromEntries(keys.map(key => [key, storage.getItem(key)]));
  if (storage.getItem(CONFIG_RECOVERY_BACKUP_KEY) === null)
    storage.setItem(CONFIG_RECOVERY_BACKUP_KEY, JSON.stringify(before));

  const waypointKey = "lawengwanla-waypoint-settings-v1";
  const current = record(parse(before[waypointKey]));
  const recovered = record(RECOVERED_BROWSER_CONFIG[waypointKey]);
  const waypoints = {...current};
  for (const [cell, value] of Object.entries(recovered)) {
    const existing = record(current[cell]);
    const restored = {...existing, ...record(value)};
    // The disk snapshot predates the separate-axis editor. Keep any newer
    // axis/stop values still present in this browser instead of guessing them.
    for (const key of ["distance_offset_x_m", "distance_offset_y_m", "distance_offset_axis", "stop_here"])
      if (existing[key] !== undefined) restored[key] = existing[key];
    waypoints[cell] = restored;
  }
  storage.setItem(waypointKey, JSON.stringify(waypoints));

  const executionKey = "lawengwanla-mainprogram-settings-v2";
  storage.setItem(executionKey, JSON.stringify({
    ...record(parse(before[executionKey])),
    ...record(RECOVERED_BROWSER_CONFIG[executionKey]),
  }));

  const routeKey = "lawengwanla-maze-route-v1";
  const route = parse(before[routeKey]);
  if (!Array.isArray(route) || route.length === 0)
    storage.setItem(routeKey, JSON.stringify(RECOVERED_BROWSER_CONFIG[routeKey]));

  const rackKey = "lawengwanla-rack-mission-v1";
  const rack = record(parse(before[rackKey]));
  if (rack.plate == null && rack.color == null && (!Array.isArray(rack.picks) || !rack.picks.length))
    storage.setItem(rackKey, JSON.stringify(RECOVERED_BROWSER_CONFIG[rackKey]));

  storage.setItem("lawengwanla-pattern1-named-settings-v1", "done");
  storage.setItem(CONFIG_RECOVERY_KEY, "done");
  return true;
}
