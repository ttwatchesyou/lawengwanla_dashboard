import useMazeTurbo from "../../utils/useMazeTurbo";
import MazeTurboControls from "../../components/MazeTurboControls";
import usePickupPreposition from "../../utils/usePickupPreposition";
import { pickupKey } from "../../utils/pickupPreposition";
import ApproachTest from "../../components/ApproachTest";
import ApproachSettingsEditor from "../../components/ApproachSettingsEditor";
import { restoreRecoveredConfiguration } from "../../utils/recoveredConfiguration";
import useLiveOdometry from "../../utils/useLiveOdometry";
import {
  DEFAULT_EXECUTION_SETTINGS,
  EXECUTION_SETTINGS_KEY,
  ExecutionSettings,
  validExecutionSettings,
} from "../../utils/mainprogramSettings";
import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { DownloadOutlined } from "@ant-design/icons";
import Layout from "../../components/Layout/Layout";
import RackMissionControls from "../../components/RackMissionControls";
import PlannerNavigation from "../../components/PlannerNavigation";
import MissionStartPanel from "../../components/MissionStartPanel";
import { missionChecks } from "../../utils/missionReadiness";
import MazePresetSelector from "../../components/MazePresetSelector";
import MazeStationOverview from "../../components/MazeStationOverview";
import RobotScene3D from "../../components/RobotScene3D";
import {
  ROBOT_INITIAL_HEADING_DEG,
  ROBOT_PROFILE,
} from "../../utils/robotSimulation";
import RobotProximityPanel from "../../components/RobotProximityPanel";
import WaypointSettingsEditor from "../../components/WaypointSettingsEditor";
import RouteStepList from "../../components/RouteStepList";
import MissionRetryPlanner from "../../components/MissionRetryPlanner";
import {
  missionPlanKey,
  missionTasks,
  RETRY_POLICY,
} from "../../utils/missionRetry";
import {
  restoreWaypointSettings,
  correctedWaypointPositions,
  distanceOffsetsValid,
  executionRoute,
  settingsForCell,
  WAYPOINT_SETTINGS_KEY,
  WaypointSettingsMap,
} from "../../utils/waypointSettings";
import { MAZE_STATION_LAYOUT } from "../../utils/mazeStations";
import {
  matchingPreset,
  MazePreset,
  removeInferredPattern1Settings,
  PATTERN_1_MIGRATION_KEY,
} from "../../utils/mazePresets";
import {
  emptyRackSelection,
  rackMission,
  RackSelection,
  RACK_STORAGE_KEY,
  restoreRackSelection,
} from "../../utils/rackMission";
import { NextPageWithLayout } from "./_app";
import {
  adjacent,
  CELL_METERS,
  cellKey,
  cellLabel,
  GRID_SIZE,
  MAX_ROUTE_CELLS,
  MazeCell,
  nextCells,
  restoreRoute,
  ROUTE_STORAGE_KEY,
  routeSegments,
  sameCell,
  ENTRY_CELL,
  isExitCell,
} from "../../utils/mazeRoute";

const gridCells = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => ({
  row: GRID_SIZE - 1 - Math.floor(index / GRID_SIZE),
  col: index % GRID_SIZE,
}));
const svgPoint = (cell: MazeCell) =>
  `${cell.col * 100 + 50},${(GRID_SIZE - 1 - cell.row) * 100 + 50}`;

const shortLandscape = "@media (min-width: 741px) and (max-height: 740px)";

const MazePlanner: NextPageWithLayout = () => {
  const [route, setRoute] = useState<MazeCell[]>([]);
  const [executionSettings, setExecutionSettings] = useState<ExecutionSettings>(
    DEFAULT_EXECUTION_SETTINGS
  );
  const [executionLoaded, setExecutionLoaded] = useState(false);
  const liveOdometry = useLiveOdometry(executionSettings, executionLoaded);
  const mainprogramReady =
    !!liveOdometry.state.ready &&
    liveOdometry.fresh &&
    !["RUN", "STOPPING"].includes(liveOdometry.state.status);
  useEffect(() => {
    try {
      restoreRecoveredConfiguration(window.localStorage);
      const current = window.localStorage.getItem(EXECUTION_SETTINGS_KEY);
      const saved = JSON.parse(
        current ||
          window.localStorage.getItem("lawengwanla-mainprogram-settings-v1") ||
          "null"
      );
      if (validExecutionSettings(saved))
        setExecutionSettings(
          current
            ? saved
            : {
                ...saved,
                start_mode: "outside_a6",
                outside_clearance_m: Math.max(0.05, saved.outside_clearance_m),
              }
        );
    } catch {}
    setExecutionLoaded(true);
  }, []);
  useEffect(() => {
    if (executionLoaded) {
      try {
        window.localStorage.setItem(
          EXECUTION_SETTINGS_KEY,
          JSON.stringify(executionSettings)
        );
      } catch {}
    }
  }, [executionSettings, executionLoaded]);

  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState(false);
  const [presetOpen, setPresetOpen] = useState(false);
  const [approachEditOpen, setApproachEditOpen] = useState(false);
  const [mapView, setMapView] = useState<"route" | "stations" | "live">("live");
  const [rackSelection, setRackSelection] =
    useState<RackSelection>(emptyRackSelection);
  const pickup = usePickupPreposition(rackSelection.picks, liveOdometry.state, liveOdometry.fresh);
  const changeRack = (next: RackSelection) => {
    if (pickup.locked) return;
    setRackSelection(next);
    if (pickupKey(next.picks) !== pickupKey(rackSelection.picks)) void pickup.prepare(next.picks);
  };
  const [rackReady, setRackReady] = useState(false);
  const [rackStorageError, setRackStorageError] = useState(false);
  const [waypointSettings, setWaypointSettings] = useState<WaypointSettingsMap>(
    {}
  );
  const turbo = useMazeTurbo(route, waypointSettings, executionSettings, liveOdometry);
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsStorageError, setSettingsStorageError] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(WAYPOINT_SETTINGS_KEY);
      const savedRoute = restoreRoute(
        JSON.parse(localStorage.getItem(ROUTE_STORAGE_KEY) || "[]")
      );
      let restored = restoreWaypointSettings(
        JSON.parse(saved || "{}"),
        savedRoute
      );
      if (
        matchingPreset(savedRoute)?.id === "pattern-1" &&
        !localStorage.getItem(PATTERN_1_MIGRATION_KEY)
      ) {
        restored = removeInferredPattern1Settings(restored);
        localStorage.setItem(PATTERN_1_MIGRATION_KEY, "done");
      }
      setWaypointSettings({
        ...matchingPreset(savedRoute)?.waypointSettings,
        ...restored,
      });
    } catch {
      setSettingsStorageError(true);
    }
    setSettingsReady(true);
  }, []);
  useEffect(() => {
    if (!settingsReady) return;
    try {
      localStorage.setItem(
        WAYPOINT_SETTINGS_KEY,
        JSON.stringify(waypointSettings)
      );
      setSettingsStorageError(false);
    } catch {
      setSettingsStorageError(true);
    }
  }, [waypointSettings, settingsReady]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(RACK_STORAGE_KEY);
      if (saved) {
        const restored = restoreRackSelection(JSON.parse(saved));
        restored.picks = restored.picks.filter((cell, index, all) => all.findIndex(other => other.row === cell.row) === index);
        setRackSelection(restored);
      }
    } catch {
      setRackStorageError(true);
    }
    setRackReady(true);
  }, []);

  useEffect(() => {
    if (!rackReady) return;
    try {
      window.localStorage.setItem(
        RACK_STORAGE_KEY,
        JSON.stringify(rackSelection)
      );
      setRackStorageError(false);
    } catch {
      setRackStorageError(true);
    }
  }, [rackReady, rackSelection]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(ROUTE_STORAGE_KEY);
      if (saved) {
        const parsed: unknown = JSON.parse(saved);
        const restored = restoreRoute(parsed);
        setRoute(restored);
        if (!Array.isArray(parsed) || restored.length !== parsed.length)
          setMessage(
            "ปรับ draft เดิมให้เหลือเฉพาะช่องที่ต่อเนื่องกันแล้ว กรุณาตรวจเส้นทางอีกครั้ง"
          );
        else if (restored.length && !sameCell(restored[0], ENTRY_CELL))
          setMessage(
            "เก็บ draft เดิมไว้แล้ว แต่กติกาใหม่ต้องเข้าที่ A8 กรุณาเลือกพรีเซ็ตหรือแก้เส้นทางก่อนเริ่ม"
          );
      }
    } catch {
      setMessage("อ่าน draft เดิมไม่ได้ สามารถเริ่มวางเส้นทางใหม่ได้");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(route));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [route, ready]);

  const segments = useMemo(() => routeSegments(route), [route]);
  const candidates = useMemo(() => nextCells(route), [route]);
  const correctedPositions = correctedWaypointPositions(
    route,
    waypointSettings,
    executionSettings.cell_m,
    executionSettings.start_mode === "outside_a6"
      ? executionSettings.approach_offset_x_m ?? 0
      : 0,
    executionSettings.start_mode === "outside_a6"
      ? executionSettings.approach_offset_y_m ?? 0
      : 0
  );
  const runRoute = executionRoute(route, waypointSettings);
  const stopCell = route.find(
    (cell) => settingsForCell(waypointSettings, cell).stop_here
  );
  const totalDistance = correctedPositions
    .slice(0, runRoute.length)
    .reduce(
      (sum, point, index, points) =>
        index
          ? sum +
            Math.hypot(
              point.x - points[index - 1].x,
              point.y - points[index - 1].y
            )
          : sum,
      0
    );
  const turns = segments
    .slice(1)
    .filter(
      (segment, index) => segment.heading !== segments[index].heading
    ).length;
  const complete = route.length === MAX_ROUTE_CELLS;
  const end = route[route.length - 1];
  const path = route.map(svgPoint).join(" ");
  const activePreset = useMemo(() => matchingPreset(route), [route]);
  const finishRow = end && isExitCell(end) ? end.row : 0;
  const checks = useMemo(
    () => [
      ...missionChecks(route, rackSelection, waypointSettings),
      {
        id: "execution-settings",
        label: "ระยะและจุดเริ่มจริงถูกต้อง",
        passed:
          executionLoaded &&
          validExecutionSettings(executionSettings) &&
          distanceOffsetsValid(
            route,
            waypointSettings,
            executionSettings.cell_m,
            executionSettings.start_mode,
            executionSettings.outside_clearance_m
          ),
        detail: "ระยะหลังปรับ +/− ต้องเหลืออย่างน้อย 1 ซม. และไม่ย้อนทิศ",
        section: "maze-map",
      },
      {
        id: "mainprogram-ready",
        label: "Mainprogram และบอร์ดล้อพร้อม",
        passed: mainprogramReady,
        detail: "เปิด Mainprogram ในหน้า Service และรอพิกัดล้อ",
        section: "maze-map",
      },
    ],
    [
      route,
      rackSelection,
      waypointSettings,
      executionSettings,
      executionLoaded,
      mainprogramReady,
    ]
  );

  const selectCell = (cell: MazeCell) => {
    if (!ready) return;
    if (!route.length && !sameCell(cell, ENTRY_CELL)) {
      setMessage(
        "START อยู่นอกสนามซ้าย A6 แล้วเข้าช่องแรก A8 กรุณาเริ่มที่ A8 หรือเลือกพรีเซ็ต"
      );
      return;
    }
    const existing = route.findIndex((item) => sameCell(item, cell));
    if (existing >= 0) {
      setEditIndex(existing);
      setMessage(`เปิดค่ารายช่อง ${cellLabel(cell)} · เส้นทางยังคงเดิม`);
      return;
    }
    if (complete) {
      setMessage(
        `ครบ ${MAX_ROUTE_CELLS} ช่องแล้ว ใช้ดินสอปรับค่า หรือ × เพื่อลบพร้อมยืนยัน`
      );
      return;
    }
    if (end && !adjacent(end, cell)) {
      setMessage(
        `เลือกช่องที่ติดกับ ${cellLabel(end)} เท่านั้น: ${
          candidates.map(cellLabel).join(" · ") ||
          "ไม่มีช่องว่างให้ต่อ กรุณาย้อนเส้นทาง"
        }`
      );
      return;
    }
    setRoute([...route, cell]);
    setMessage(`เพิ่มลำดับ ${route.length + 1} ที่ ${cellLabel(cell)} แล้ว`);
  };

  const applyPreset = (preset: MazePreset) => {
    if (preset.id === "pattern-1") {
      try {
        localStorage.setItem(PATTERN_1_MIGRATION_KEY, "done");
      } catch {}
    }
    setRoute(preset.route.map((cell) => ({ ...cell })));
    if (preset.waypointSettings)
      setWaypointSettings((previous) => {
        const next = { ...previous };
        for (const cell of preset.route) delete next[cellKey(cell)];
        return {
          ...next,
          ...Object.fromEntries(
            Object.entries(preset.waypointSettings!).map(([key, value]) => [
              key,
              { ...value },
            ])
          ),
        };
      });
    setPresetOpen(false);
    setMessage(
      `ใช้${preset.name} (${
        preset.imagePosition
      }) แล้ว · START นอกสนามซ้าย A6 → A8 → H1 · ${MAX_ROUTE_CELLS} ช่องในสนาม${
        preset.waypointSettings
          ? " · โหลดค่าความเร็ว tolerance และระยะ +/− รายช่องแล้ว"
          : ""
      }`
    );
  };

  const missionJson = () =>
    JSON.stringify(
      {
        grid_m: 8 * executionSettings.cell_m,
        plan_key: missionPlanKey(route, rackSelection, waypointSettings),
        cell_m: executionSettings.cell_m,
        execution_settings: executionSettings,
        stop_at_cell: stopCell ? cellLabel(stopCell) : null,
        preset_id: activePreset?.id ?? null,
        start_rule: {
          outside_field: true,
          edge: "left",
          aligned_to: "A6",
          entry_cell: "A8",
          approach: "outside-left-of-A6 to outside-left-of-A8, then enter A8",
          clearance_m: null,
          counted_in_route: false,
        },
        waypoints: route.map((cell, index) => ({
          sequence: index + 1,
          row: cell.row + 1,
          column: cell.col + 1,
          x_m: Number(correctedPositions[index].x.toFixed(3)),
          y_m: Number(correctedPositions[index].y.toFixed(3)),
          ...settingsForCell(waypointSettings, cell),
          saved_heading_deg: settingsForCell(waypointSettings, cell)
            .heading_deg,
          heading_deg: ROBOT_INITIAL_HEADING_DEG,
        })),
        waypoint_policy: {
          heading_frame: "boot_relative",
          heading_reference: "boot_zero",
          heading_zero: "robot_front_at_board_boot",
          heading_positive: "counter_clockwise",
          heading_application: "hold_initial_heading_for_entire_mission",
          initial_heading_deg: ROBOT_INITIAL_HEADING_DEG,
          per_waypoint_rotation_enabled: false,
          null_heading: "inherit_fixed_initial_heading",
          drive_mode: "holonomic_mecanum_translation",
          tolerances_applied_by:
            "future_robot_controller_not_visual_simulation",
        },
        rack_task: rackMission(rackSelection),
        station_layout: MAZE_STATION_LAYOUT,
        robot_profile: ROBOT_PROFILE,
        retry_policy: RETRY_POLICY,
        mission_tasks: missionTasks(rackSelection),
        exit_rule: {
          edge: "right",
          allowed_cells: Array.from({ length: 8 }, (_, row) => `H${row + 1}`),
        },
        finish_rule: {
          outside_field: !stopCell,
          edge: "right",
          aligned_to: stopCell
            ? cellLabel(stopCell)
            : end && isExitCell(end)
            ? cellLabel(end)
            : null,
          clearance_m: null,
        },
      },
      null,
      2
    );

  const download = () => {
    const url = URL.createObjectURL(
      new Blob([missionJson()], { type: "application/json" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lawengwanla-maze-mission.json";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("ดาวน์โหลดแผน แล้ว");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(missionJson());
      setMessage("คัดลอก Mission JSON แล้ว");
    } catch {
      setMessage("คัดลอกไม่ได้ในเบราว์เซอร์นี้ ใช้ปุ่มดาวน์โหลด JSON แทนได้");
    }
  };

  return (
    <Page>
      <Head>
        <title>Maze Planner · Lawengwanla</title>
      </Head>
      <Inner>
        <PageHeading>
          <div>
            <h1>วางแผนการเคลื่อนที่</h1>
          </div>
          <ModeBadge>
            <span /> โหมดวางแผน
          </ModeBadge>
        </PageHeading>
        <PlannerNavigation />
        <Metrics>
          <Metric>
            <span>ช่องในเส้นทาง</span>
            <strong>
              {route.length}
              <small> / {MAX_ROUTE_CELLS}</small>
            </strong>
            <Progress
              role="progressbar"
              aria-label="ช่องในเส้นทาง"
              aria-valuenow={route.length}
              aria-valuemin={0}
              aria-valuemax={MAX_ROUTE_CELLS}
            >
              <i
                style={{ width: `${(route.length / MAX_ROUTE_CELLS) * 100}%` }}
              />
            </Progress>
          </Metric>
          <Metric>
            <span>ระยะรวมระหว่างช่อง</span>
            <strong>
              {totalDistance.toFixed(2)}
              <small> m</small>
            </strong>
            <em>{segments.length} ช่วงการเดิน</em>
          </Metric>
          <Metric>
            <span>เปลี่ยนทิศเส้นทาง</span>
            <strong>
              {turns}
              <small> ครั้ง</small>
            </strong>
            <em>หัวหุ่นคงทิศเดิม</em>
          </Metric>
        </Metrics>
        <Workspace>
          <Card id="maze-map">
            <CardHeading>
              <div>
                <h2>แผนที่สนาม</h2>
              </div>
              <PresetButton
                type="button"
                onClick={() => setPresetOpen(true)}
                disabled={!ready}
              >
                {activePreset?.name ?? "เลือกพรีเซ็ต"} ▾
              </PresetButton>
              <QuickSettings
                type="button"
                disabled={!route.length || !settingsReady}
                onClick={() => setEditIndex(0)}
              >
                ค่ารายช่อง
              </QuickSettings>
            </CardHeading>
            <MapBody>
              <MapModes role="group" aria-label="มุมมองแผนที่">
                <button
                  type="button"
                  aria-pressed={mapView === "route"}
                  onClick={() => setMapView("route")}
                >
                  แก้เส้นทาง
                </button>
                <button
                  type="button"
                  aria-pressed={mapView === "stations"}
                  onClick={() => setMapView("stations")}
                >
                  ผังสถานี
                </button>
                <button
                  type="button"
                  aria-pressed={mapView === "live"}
                  onClick={() => setMapView("live")}
                >
                  ตำแหน่งจริง
                </button>
              </MapModes>
              <MapCaption>
                <b>
                  {complete
                    ? end && isExitCell(end)
                      ? `ครบ ${MAX_ROUTE_CELLS} ช่อง · ถึงทางออกขวา`
                      : `เลือก ${MAX_ROUTE_CELLS} ช่อง · หยุดที่ ${cellLabel(
                          end!
                        )}`
                    : end
                    ? `ต่อจาก ${cellLabel(end)}`
                    : "START ซ้าย A6 → เข้าที่ A8"}
                </b>
                <span>
                  {mapView === "live"
                    ? "ตำแหน่งจากเซนเซอร์"
                    : mapView === "stations"
                    ? "แตะตู้เพื่อตั้งค่า"
                    : complete
                    ? "แตะช่องเพื่อปรับค่า"
                    : end
                    ? "แตะช่องขอบเส้นประเพื่อไปต่อ"
                    : "เลือกพรีเซ็ต หรือแตะ A8 เป็นช่องที่ 1"}
                </span>
              </MapCaption>
              {mapView === "live" ? (
                <RobotScene3D
                  route={route}
                  selection={rackSelection}
                  live={liveOdometry}
                  cellMeters={executionSettings.cell_m}
                  settings={waypointSettings}
                  onEditStart={() => setApproachEditOpen(true)}
                  onEditCell={setEditIndex}
                  startPoint={{
                    x: -executionSettings.outside_clearance_m,
                    y: 7.5 * executionSettings.cell_m - 2,
                  }}
                />
              ) : mapView === "stations" ? (
                <MazeStationOverview route={route} selection={rackSelection} />
              ) : (
                <>
                  <MapLayout>
                    <OutsideLane aria-label="START นอกสนามด้านซ้ายของ A6">
                      <LanePath
                        viewBox="0 0 48 800"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        <polyline
                          points="24,250 24,50 48,50"
                          fill="none"
                          stroke="#98e8de"
                          strokeWidth="2"
                          strokeDasharray="6 5"
                        />
                        <polyline
                          points="42,40 48,50 42,60"
                          fill="none"
                          stroke="#98e8de"
                          strokeWidth="2"
                        />
                      </LanePath>
                      <OutsideLabel
                        as="button"
                        type="button"
                        aria-label="START บนแผนที่: ปรับระยะก่อนเข้าสนาม"
                        onClick={() => setApproachEditOpen(true)}
                        $top={31.25}
                        $finish={false}
                      >
                        <b>START</b>
                        <small>ซ้าย A6</small>
                      </OutsideLabel>
                    </OutsideLane>
                    <RowLabels aria-hidden="true">
                      {Array.from({ length: 8 }, (_, index) => (
                        <span key={index}>{8 - index}</span>
                      ))}
                    </RowLabels>
                    <Grid
                      role="group"
                      aria-label="แผนที่ 8 คูณ 8 ช่อง"
                      aria-busy={!ready}
                    >
                      {gridCells.map((cell) => {
                        const position = route.findIndex((item) =>
                          sameCell(item, cell)
                        );
                        const selected = position >= 0;
                        const available = candidates.some((item) =>
                          sameCell(item, cell)
                        );
                        const isEnd = selected && position === route.length - 1;
                        const isStop =
                          selected &&
                          !!settingsForCell(waypointSettings, cell).stop_here;
                        return (
                          <CellButton
                            key={cellKey(cell)}
                            type="button"
                            disabled={!ready}
                            $selected={selected}
                            $available={available}
                            $start={position === 0}
                            $end={isEnd}
                            $muted={route.length > 0 && !selected && !available}
                            $exit={isExitCell(cell)}
                            $stop={isStop}
                            aria-disabled={!selected && !!end && !available}
                            aria-pressed={selected}
                            aria-label={`${cellLabel(cell)}${
                              isExitCell(cell) ? " ทางออกฝั่งขวา" : ""
                            }${
                              selected
                                ? ` ลำดับ ${position + 1}${
                                    isEnd
                                      ? " แตะเพื่อปรับค่า"
                                      : " แตะเพื่อปรับค่า"
                                  }`
                                : available
                                ? " เลือกเป็นช่องถัดไป"
                                : end
                                ? " ไม่ต่อกับปลายเส้นทาง"
                                : " เลือกเป็นจุดเริ่มต้น"
                            }`}
                            onClick={() => selectCell(cell)}
                          >
                            <Coord>{cellLabel(cell)}</Coord>
                            {isStop && (
                              <StopMarker
                                data-testid={`map-stop-${cellLabel(cell)}`}
                                title="หยุดจบที่ช่องนี้"
                              >
                                <i /> STOP
                              </StopMarker>
                            )}
                            {isExitCell(cell) && (
                              <ExitMarker aria-hidden="true">↦</ExitMarker>
                            )}
                            {selected ? (
                              <Sequence $start={position === 0} $end={isEnd}>
                                {position + 1}
                              </Sequence>
                            ) : available ? (
                              <NextMarker>+</NextMarker>
                            ) : (
                              <Dot />
                            )}
                          </CellButton>
                        );
                      })}
                      <RouteOverlay viewBox="0 0 800 800" aria-hidden="true">
                        {route.length > 1 && (
                          <>
                            <polyline
                              points={path}
                              fill="none"
                              stroke="#1e3271"
                              strokeWidth="17"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                            <polyline
                              points={path}
                              fill="none"
                              stroke="#ffdc7c"
                              strokeWidth="8"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                            {segments.map((segment, index) => (
                              <polyline
                                key={index}
                                points="-7,-8 1,0 -7,8"
                                fill="none"
                                stroke="#ffdc7c"
                                strokeWidth="5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                transform={`translate(${
                                  (segment.from.col + segment.to.col + 1) * 50
                                } ${
                                  (15 - segment.from.row - segment.to.row) * 50
                                }) rotate(${
                                  (-segment.heading * 180) / Math.PI
                                })`}
                              />
                            ))}
                          </>
                        )}
                      </RouteOverlay>
                    </Grid>
                    <OutsideLane
                      $right
                      aria-label={`FINISH นอกสนามด้านขวาของ H${finishRow + 1}`}
                    >
                      <OutsideLabel
                        $top={((7 - finishRow + 0.5) / 8) * 100}
                        $finish
                      >
                        <b>FINISH</b>
                        <small>ขวา H{finishRow + 1}</small>
                      </OutsideLabel>
                    </OutsideLane>
                    <ColumnLabels aria-hidden="true">
                      {"ABCDEFGH".split("").map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </ColumnLabels>
                  </MapLayout>
                  <Legend>
                    <span>
                      <i className="start" /> จุดเข้า A8
                    </span>
                    <span>
                      <i className="route" /> เส้นทาง
                    </span>
                    <span>
                      <i className="end" /> ปลายทาง
                    </span>
                    <span>
                      <i className="next" /> เลือกต่อได้
                    </span>
                  </Legend>
                </>
              )}
            </MapBody>
          </Card>
          <SidePanel>
            <RouteStepList
              route={route}
              settings={waypointSettings}
              onEdit={setEditIndex}
              onChange={(next, notice) => {
                setRoute(next);
                setEditIndex(null);
                setMessage(notice);
              }}
            />
          </SidePanel>
        </Workspace>
        {message && (
          <Feedback role="status" aria-live="polite">
            {message}
          </Feedback>
        )}
        <RackMissionControls
          selection={rackSelection}
          onChange={changeRack}
          locked={pickup.locked}
          preparation={<div role="status" style={{ padding: 16 }}>
            <p>{pickup.locked ? "ล็อกตำแหน่งชุดจับ · ปิดรับคำสั่งเลื่อน" : pickup.prepared ? "ชุดจับถึงตำแหน่งแล้ว" : "จัดชุดจับได้ตามต้องการ · ไม่บังคับก่อนเริ่มวิ่ง"}</p>
            {!pickup.locked && <button type="button" disabled={pickup.busy || !rackSelection.picks.length} onClick={() => void pickup.prepare(rackSelection.picks)}>{pickup.busy ? "กำลังส่งคำสั่ง…" : "จัดชุดจับตามช่องที่เลือก"}</button>}
            {pickup.locked && <button type="button" disabled={!pickup.canReset} onClick={() => void pickup.reset()}>เตรียมรอบใหม่</button>}
            {pickup.error && <p role="alert">{pickup.error}</p>}
          </div>}
          ready={rackReady}
          storageError={rackStorageError}
          onExport={download}
        />
        <SectionTitle>ควบคุมและตรวจสอบ</SectionTitle>
        <MazeTurboControls turbo={turbo} />
        <OperationsGrid>
          <RobotProximityPanel
            route={route}
            simulation={turbo.simulation}
            settings={waypointSettings}
          />
          <ApproachTest
            live={liveOdometry}
            settings={executionSettings}
            onEditSettings={() => setApproachEditOpen(true)}
          />
          <ApproachSettingsEditor
            open={approachEditOpen}
            settings={executionSettings}
            busy={["RUN", "STOPPING"].includes(liveOdometry.state.status)}
            onClose={() => setApproachEditOpen(false)}
            onSave={setExecutionSettings}
          />
        </OperationsGrid>
        <MissionStartPanel
          onStartAttempt={turbo.onRun}
          checks={checks}
          motionBusy={["RUN", "STOPPING"].includes(liveOdometry.state.status)}
          unlockKey={JSON.stringify({ plan: missionPlanKey(route, rackSelection, waypointSettings), execution: executionSettings })}
          loaded={ready && rackReady && settingsReady}
          payload={() => ({
            plan_key: missionPlanKey(route, rackSelection, waypointSettings),
            route,
            execution_settings: executionSettings,
            rack_selection: rackSelection,
            waypoint_settings: Object.fromEntries(
              route.map((cell) => [
                cellKey(cell),
                {
                  ...settingsForCell(waypointSettings, cell),
                  heading_deg: ROBOT_INITIAL_HEADING_DEG,
                },
              ])
            ),
            motion_policy: {
              mode: "fixed_heading_mecanum",
              heading_reference: "boot_zero",
              initial_heading_deg: ROBOT_INITIAL_HEADING_DEG,
              per_waypoint_rotation_enabled: false,
            },
            retry_policy: RETRY_POLICY,
            mission_tasks: missionTasks(rackSelection),
          })}
        />

        {stopCell && (
          <p role="status">
            หยุดจบที่ {cellLabel(stopCell)} · วิ่ง {runRoute.length}{" "}
            ช่องแรกจากเส้นทางทั้งหมด {route.length} ช่อง
          </p>
        )}
        <MissionRetryPlanner
          developerTools={
            <>
              <ExportCard>
                <ExportHeading>
                  <h2>ส่งออกแผน</h2>
                  <span>
                    {storageError || settingsStorageError
                      ? "บันทึกอัตโนมัติไม่ได้"
                      : ready
                      ? "บันทึกอัตโนมัติ"
                      : "กำลังโหลด…"}
                  </span>
                </ExportHeading>
                <PrimaryButton
                  type="button"
                  onClick={download}
                  disabled={route.length < 2}
                >
                  <DownloadOutlined /> ดาวน์โหลดแผน
                </PrimaryButton>
                <CopyButton
                  type="button"
                  onClick={copy}
                  disabled={route.length < 2}
                >
                  คัดลอก JSON
                </CopyButton>
              </ExportCard>
              <Hint>
                การเข้าช่องใช้ตำแหน่งที่หยุดจริงเป็นแนวอ้างอิง ·
                ความเร็วและค่าควบคุมตามแผนและเฟิร์มแวร์
              </Hint>
            </>
          }
          route={route}
          selection={rackSelection}
          settings={waypointSettings}
          ready={
            ready &&
            rackReady &&
            settingsReady &&
            checks.every((check) => check.passed)
          }
        />

        <WaypointSettingsEditor
          index={editIndex}
          route={route}
          settings={waypointSettings}
          onSelect={setEditIndex}
          onSave={(cell, value) => {
            setWaypointSettings((previous) => ({
              ...previous,
              [cellKey(cell)]: value,
            }));
            setMessage(`บันทึกค่าการวิ่ง ${cellLabel(cell)} แล้ว`);
          }}
        />
        <MazePresetSelector
          open={presetOpen}
          selectedId={activePreset?.id}
          hasRoute={route.length > 0}
          onClose={() => setPresetOpen(false)}
          onSelect={applyPreset}
        />
      </Inner>
    </Page>
  );
};

MazePlanner.getLayout = (page) => <Layout hideFooter>{page}</Layout>;
export default MazePlanner;

const Page = styled.section`
  min-height: 100dvh;
  padding: 104px 28px 40px;
  background: #fffbde;
  color: #1e3271;
  button {
    font: inherit;
    cursor: pointer;
    touch-action: manipulation;
  }
  button:disabled {
    cursor: default;
    opacity: 0.45;
  }
  button:focus-visible {
    outline: 3px solid #45a9a9;
    outline-offset: 3px;
  }
  @media (max-width: 600px) {
    padding: 94px 16px 28px;
  }
  ${shortLandscape} {
    padding: 94px 20px 28px;
  }
`;
const MapModes = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-bottom: 8px;
  button {
    min-height: 34px;
    padding: 4px;
    background: #293f77;
    color: #cbd8ee;
    border: 1px solid #6879a4;
    border-radius: 7px;
    font-size: 10px !important;
  }
  button[aria-pressed="true"] {
    color: #1e3271;
    background: #ffdc7c;
    border-color: #ffdc7c;
    font-weight: 600;
  }
`;
const QuickSettings = styled.button`
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid #6d8eab;
  border-radius: 7px;
  background: #314b7c;
  color: #98e8de;
  font-size: 11px !important;
  white-space: nowrap;
`;
const PresetButton = styled.button`
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid #a58db7;
  border-radius: 7px;
  background: #4e1f6e;
  color: #ffdc7c;
  font-size: 11px !important;
  white-space: nowrap;
`;
const Inner = styled.div`
  position: relative;
  max-width: 1280px;
  margin: auto;
`;
const PageHeading = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  h1 {
    font-size: clamp(24px, 2.5vw, 32px);
    font-weight: 600;
    line-height: 1.2;
    margin: 5px 0;
    color: #1e3271;
  }
  h1 span {
    color: #52617e;
  }
  @media (max-width: 480px) {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  ${shortLandscape} {
    min-height: 46px;
    margin-bottom: 12px;
    h1 {
      font-size: 24px;
      margin: 0;
    }
  }
`;
const ModeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 12px;
  border-radius: 24px;
  border: 1px solid #ddcfe2;
  color: #4e1f6e;
  background: #f5edf6;
  font-size: 11px;
  white-space: nowrap;
  span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #9764ac;
  }
  ${shortLandscape} {
    display: none;
  }
`;
const Metrics = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
  @media (max-width: 480px) {
    gap: 8px;
  }
`;
const Metric = styled.div`
  background: #fffef5;
  border: 1px solid #e6dfbe;
  border-radius: 12px;
  padding: 13px 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  > span {
    font-size: 11px;
    color: #687087;
  }
  strong {
    font-size: 26px;
    line-height: 1.25;
    font-weight: 700;
  }
  small {
    font-size: 12px;
    font-weight: 500;
    color: #7a8193;
  }
  em {
    font-size: 10px;
    font-style: normal;
    color: #7a8193;
  }
  @media (max-width: 480px) {
    padding: 10px;
    strong {
      font-size: 21px;
    }
    > span {
      font-size: 10px;
    }
  }
  ${shortLandscape} {
    padding: 5px 10px;
    gap: 1px;
    border-radius: 8px;
    > span {
      font-size: 9px;
    }
    strong {
      font-size: 19px;
    }
    small {
      font-size: 10px;
    }
    em {
      display: none;
    }
  }
`;
const Progress = styled.div`
  height: 4px;
  background: #eee9d2;
  border-radius: 4px;
  margin-top: 7px;
  i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: #4e1f6e;
    transition: width 0.2s;
  }
  ${shortLandscape} {
    display: none;
  }
`;
const Workspace = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 20px;
  align-items: stretch;
  @media (max-width: 740px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const Card = styled.section`
  scroll-margin-top: 92px;
  min-width: 0;
  background: #1e3271;
  border: 1px solid #34477d;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 5px 16px #1e327110;
  color: #f7f4e6;
`;
const CardHeading = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  min-height: 68px;
  flex-wrap: wrap;
  border-bottom: 1px solid #415386;
  > div {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    color: #ffdc7c;
  }
  h2 {
    font-size: 14px;
    font-weight: 600;
    color: inherit;
    margin: 0;
  }
  > span {
    font-size: 10px;
    color: #d2d8ec;
    border: 1px solid #546598;
    border-radius: 5px;
    padding: 3px 7px;
    white-space: nowrap;
  }
  ${shortLandscape} {
    padding: 9px 14px;
  }
`;
const MapBody = styled.div`
  background: #1e3271;
  padding: 18px 20px;
  @media (max-width: 480px) {
    padding: 12px 10px;
  }
  ${shortLandscape} {
    padding: 8px 14px;
  }
`;
const MapCaption = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 0 3px 12px;
  b {
    font-size: 12px;
    color: #ffdc7c;
  }
  span {
    font-size: 10px;
    color: #c4cce5;
  }
  ${shortLandscape} {
    padding-bottom: 7px;
  }
`;
const MapLayout = styled.div`
  display: grid;
  grid-template-columns: 48px 14px minmax(0, 1fr) 42px;
  grid-template-rows: auto 22px;
  gap: 4px;
  ${shortLandscape} {
    max-width: min(100%, calc(100dvh - 164px));
    margin: auto;
    grid-template-rows: auto 18px;
  }
  @media (max-width: 480px) {
    grid-template-columns: 32px 10px minmax(0, 1fr) 30px;
    gap: 3px;
  }
`;
const OutsideLane = styled.div<{ $right?: boolean }>`
  grid-row: 1;
  grid-column: ${(p) => (p.$right ? 4 : 1)};
  position: relative;
  min-width: 0;
`;
const LanePath = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
`;
const OutsideLabel = styled.div<{ $top: number; $finish: boolean }>`
  cursor: ${({ $finish }) => ($finish ? "default" : "pointer")};
  position: absolute;
  top: ${(p) => p.$top}%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  padding: 4px 1px;
  border: 1px solid ${(p) => (p.$finish ? "#ffdc7c" : "#98e8de")};
  border-radius: 4px;
  background: #182d54;
  color: ${(p) => (p.$finish ? "#ffdc7c" : "#98e8de")};
  text-align: center;
  b {
    display: block;
    font-size: 8px;
  }
  small {
    display: block;
    font-size: 7px;
    white-space: nowrap;
  }
  @media (max-width: 480px) {
    b {
      font-size: 6px;
    }
    small {
      font-size: 6px;
    }
  }
`;
const RowLabels = styled.div`
  grid-column: 2;
  grid-row: 1;
  display: grid;
  grid-template-rows: repeat(8, 1fr);
  align-items: center;
  text-align: center;
  color: #aab9df;
  font-size: 10px;
`;
const ColumnLabels = styled.div`
  grid-column: 3;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  align-items: center;
  text-align: center;
  color: #aab9df;
  font-size: 10px;
`;
const Grid = styled.div`
  grid-column: 3;
  grid-row: 1;
  isolation: isolate;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  grid-template-rows: repeat(8, minmax(0, 1fr));
  position: relative;
  aspect-ratio: 1;
  width: 100%;
  border: 1px solid #546598;
  border-radius: 9px;
  overflow: hidden;
  background: #263d77;
`;
const CellButton = styled.button<{
  $selected: boolean;
  $available: boolean;
  $start: boolean;
  $end: boolean;
  $muted: boolean;
  $exit: boolean;
  $stop: boolean;
}>`
  box-shadow: ${(p) => (p.$exit ? "inset -3px 0 0 #98e8de" : "none")};
  position: relative;
  min-width: 0;
  padding: 0;
  border: 1px solid #46598b;
  color: #dbe2f7;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${(p) =>
    p.$stop
      ? "#722f42"
      : p.$start
      ? "#225957"
      : p.$end
      ? "#63503c"
      : p.$selected
      ? "#354b85"
      : p.$available
      ? "#455078"
      : "#293e72"};
  ${(p) =>
    p.$available &&
    "&::after{content:'';position:absolute;inset:4px;border:1.5px dashed #ffdc7c;border-radius:5px;}"}
  > span:first-child {
    opacity: ${(p) => (p.$muted ? 0.45 : 0.9)};
  }
  &:hover {
    background: ${(p) =>
      p.$selected ? "#455b91" : p.$available ? "#5a5b79" : "#33497f"};
  }
  &:focus-visible {
    outline-offset: -4px;
    z-index: 4;
  }
`;
const StopMarker = styled.span`
  position: absolute;
  bottom: 3px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 3px;
  border: 1px solid #ff9292;
  border-radius: 4px;
  padding: 2px 4px;
  background: #642332;
  color: #fff1f1;
  font-size: clamp(6px, 0.8vw, 9px);
  font-weight: 800;
  i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ff6363;
    box-shadow: 0 0 7px #ff4f4f;
  }
`;
const ExitMarker = styled.span`
  position: absolute;
  right: 3px;
  top: 2px;
  color: #98e8de;
  font-size: 10px;
  z-index: 2;
`;
const Coord = styled.span`
  position: absolute;
  top: 4px;
  left: 5px;
  font-size: clamp(8px, 1vw, 10px);
  line-height: 1;
  color: #d6def3;
  z-index: 2;
`;
const Sequence = styled.span<{ $start: boolean; $end: boolean }>`
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: center;
  align-items: center;
  width: clamp(23px, 3.1vw, 34px);
  height: clamp(23px, 3.1vw, 34px);
  border-radius: 50%;
  font-size: clamp(12px, 1.4vw, 17px);
  font-weight: 700;
  line-height: 1;
  background: ${(p) => (p.$start ? "#98e8de" : p.$end ? "#ffdc7c" : "#1e3271")};
  color: ${(p) => (p.$start || p.$end ? "#1e3271" : "#ffdc7c")};
  border: 2px solid ${(p) => (p.$start ? "#98e8de" : "#ffdc7c")};
  ${shortLandscape} {
    width: 24px;
    height: 24px;
    font-size: 12px;
  }
`;
const Dot = styled.span`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #6a7aa3;
  opacity: 0.45;
`;
const NextMarker = styled.span`
  color: #ffdc7c;
  font-size: 21px;
  line-height: 1;
`;
const RouteOverlay = styled.svg`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
`;
const Legend = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px 15px;
  margin: 10px 0;
  font-size: 10px;
  color: #d2d8ec;
  span {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  i {
    width: 9px;
    height: 9px;
    border-radius: 3px;
    display: inline-block;
  }
  .start {
    background: #98e8de;
  }
  .route {
    background: #465b94;
    border: 1px solid #ffdc7c;
  }
  .end {
    background: #ffdc7c;
  }
  .next {
    border: 1px dashed #ffdc7c;
  }
`;
const SidePanel = styled.div`
  position: relative;
  min-width: 0;
  min-height: 0;
  > section {
    position: absolute;
    inset: 0;
    min-height: 0;
  }
  @media (max-width: 740px) {
    height: 540px;
    > section {
      height: 100%;
    }
  }
`;
const SectionTitle = styled.h2`
  margin: 28px 0 16px;
  color: #1e3271;
  font-size: 20px;
  font-weight: 600;
`;
const OperationsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
  > section {
    min-width: 0;
    height: 100%;
  }
  > p {
    grid-column: 1 / -1;
    margin: 0;
    font-size: 12px;
  }
  @media (max-width: 1040px) {
    grid-template-columns: 1fr;
  }
`;
const Hint = styled.p`
  font-size: 10px;
  color: #c4cfe9;
  line-height: 1.7;
  margin: 12px 0 0;
`;
const ExportCard = styled.section`
  padding: 0;
  color: #ffdc7c;
`;
const ExportHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 13px;
  h2 {
    color: #ffdc7c;
    font-size: 14px;
    margin: 0;
  }
  span {
    font-size: 9px;
    color: #c4cfe9;
  }
`;
const PrimaryButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-height: 45px;
  background: #ffdc7c;
  border: 0;
  color: #1e3271;
  border-radius: 8px;
  font-size: 12px !important;
  font-weight: 700;
  &:hover:not(:disabled) {
    background: #ffe8a4;
  }
`;
const CopyButton = styled.button`
  background: transparent;
  color: #e0e7ff;
  border: 0;
  min-height: 40px;
  display: block;
  margin: 4px auto 0;
  font-size: 11px !important;
  text-decoration: underline;
  text-underline-offset: 3px;
`;
const Feedback = styled.p`
  font-size: 12px;
  color: #4e1f6e;
  min-height: 38px;
  margin-top: 16px;
  padding: 10px 14px;
  border-left: 3px solid #c6a9d0;
  background: #f5f0db;
  border-radius: 0 7px 7px 0;
`;
