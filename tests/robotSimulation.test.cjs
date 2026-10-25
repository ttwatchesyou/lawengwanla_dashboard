const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// Load the same pure TypeScript modules used by the browser, without another test dependency.
const cache = new Map();
function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  new Function("require", "module", "exports", source)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              path.resolve(__dirname, ".."),
              path.resolve(path.dirname(filename), name + ".ts")
            )
          )
        : require(name),
    module,
    module.exports
  );
  return module.exports;
}
const { ROBOT_PROFILE, makeSimulationPlan, sampleSimulation } = load(
  "utils/robotSimulation.ts"
);
const { MAZE_PRESETS } = load("utils/mazePresets.ts");
const { robotGeometry } = load("utils/robotScene.ts");
const { CELL_METERS, cellLabel } = load("utils/mazeRoute.ts");
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
const { cabinetGeometry } = load("utils/mazeEquipment.ts");
const { MAZE_STATION_LAYOUT } = load("utils/mazeStations.ts");

test("placement cabinet opens toward bottom H lettering, with its closed rear above", () => {
  const model = cabinetGeometry(8.132, 2.385, false, {
    plate: 1,
    color: "red",
    picks: [],
  });
  assert.deepEqual(model.frontNormal, [0, -1, 0]);
  assert.ok(model.openingCenter[1] < model.rearCenter[1]);
  close(model.openingCenter[0], model.rearCenter[0]);
  const station = MAZE_STATION_LAYOUT.stations.find(
    (station) => station.id === "placement-cabinet"
  );
  assert.equal(station.front_facing, "down");
  assert.deepEqual(station.front_normal, { x: 0, y: -1 });
  assert.equal(station.front_reference_label, "H");
  assert.equal(station.front_towards_edge, "bottom_letter_labels");
  assert.equal(station.anchor_cell, "H3");
  assert.equal(station.clearance_from_field_m, 0.25);
  assert.equal(station.equipment_width_m, null);
});

test("placement cabinet keeps blue-green-red columns left to right from its opening", () => {
  const model = cabinetGeometry(8.132, 2.385, false, {
    plate: null,
    color: null,
    picks: [],
  });
  const columnX = ["#4c8dff", "#54c99b", "#f1717a"].map((color) => {
    const blocks = model.blockCenters.filter((block) => block.color === color);
    assert.equal(blocks.length, 3);
    assert.equal(new Set(blocks.map((block) => block.point[2])).size, 3);
    return blocks[0].point[0];
  });
  assert.ok(columnX[0] < columnX[1] && columnX[1] < columnX[2]);
});

test("pickup cabinet still faces down toward C8 without rotating its selected contents", () => {
  const model = cabinetGeometry(2.385, 7.992, true, {
    plate: 2,
    color: "blue",
    picks: [{ row: 0, col: 1 }],
  });
  assert.deepEqual(model.frontNormal, [0, -1, 0]);
  assert.ok(model.openingCenter[1] < model.rearCenter[1]);
  close(model.openingCenter[0], model.rearCenter[0]);
  assert.equal(model.blockCenters.length, 1);
});

const {
  missionPlanKey,
  missionTasks,
  emptyRetrySnapshot,
  retryScenario,
  buildRetryPlan,
  previewMapToOdom,
} = load("utils/missionRetry.ts");
const { routeAfterDeletion } = load("utils/routeEditing.ts");
const retryRack = {
  color: "red",
  plate: 1,
  picks: [
    { row: 0, col: 0 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
  ],
};
const retryRoute = MAZE_PRESETS[0].route;
const retryKey = missionPlanKey(retryRoute, retryRack, {});
const retryTasks = missionTasks(retryRack);
const {
  parseMissionStatus,
  missionStatusFresh,
  retryFromMissionStatus,
  missionReviewKey,
} = load("utils/missionStatus.ts");
function statusPacket(scenario = "after19", changes = {}) {
  const snapshot = retryScenario(retryKey, retryTasks, scenario);
  return {
    source_topic: "/lawengwanla/mission_status",
    publisher_count: 1,
    fresh: true,
    age_ms: 100,
    error: null,
    state: {
      schema_version: 1,
      source: "controller_ack",
      plan_key: retryKey,
      run_id: "run-test",
      pose_epoch: "pose-test",
      sequence: 5,
      highest_reached: snapshot.highest_reached,
      phase: snapshot.phase,
      run_state: "paused",
      stopped: true,
      localization_valid: false,
      block_dropped: scenario !== "folder",
      tasks: Object.fromEntries(
        retryTasks.map((task) => [
          task.id,
          snapshot.completed.includes(task.id) ? "completed" : "pending",
        ])
      ),
      ...changes,
    },
  };
}

test("missing mission status does not assume the robot is at START", () => {
  const packet = parseMissionStatus({
    source_topic: "/lawengwanla/mission_status",
    publisher_count: 0,
    fresh: false,
    age_ms: null,
    state: null,
  });
  assert.equal(missionStatusFresh(packet, 0, 0), false);
  assert.equal(
    retryFromMissionStatus(retryRoute, retryRack, {}, packet, false).plan,
    null
  );
});

test("controller snapshots compute retry before/after19 and direct folder without manual conditions", () => {
  for (const [scenario, destination] of [
    ["before19", "start"],
    ["after19", "checkpoint19"],
    ["folder", "folder"],
  ]) {
    const packet = parseMissionStatus(statusPacket(scenario));
    const result = retryFromMissionStatus(
      retryRoute,
      retryRack,
      {},
      packet,
      true
    );
    assert.deepEqual(result.errors, []);
    assert.equal(result.plan.source, "controller_ack");
    assert.equal(result.plan.destination, destination);
    assert.equal(result.plan.executable, false);
    if (scenario === "folder") {
      assert.equal(result.plan.skip_cabinet2, true);
      assert.deepEqual(
        result.plan.pending_tasks.map((task) => task.id),
        ["sheet.fold", "sheet.collect"]
      );
    }
  }
});

test("mission freshness includes server age, HTTP transit and local elapsed time", () => {
  const packet = parseMissionStatus(statusPacket());
  assert.equal(missionStatusFresh(packet, 200, 300), true);
  assert.equal(missionStatusFresh(packet, 200, 1600), false);
  for (const publisher_count of [0, 2, null])
    assert.equal(
      missionStatusFresh({ ...packet, publisher_count }, 0, 0),
      false
    );
  assert.equal(missionStatusFresh({ ...packet, age_ms: null }, 0, 0), false);
  assert.equal(
    missionStatusFresh({ ...packet, error: "Invalid packet" }, 0, 0),
    false
  );
});

test("malformed, inferred, or incomplete mission telemetry is rejected", () => {
  for (const changes of [
    { source: "sandbox" },
    { highest_reached: 38 },
    { highest_reached: true },
    { sequence: NaN },
    { schema_version: true },
    { stopped: undefined },
    { tasks: {} },
    { tasks: { "sheet.fold": "guessed" } },
    { pose_epoch: "" },
  ])
    assert.throws(() => parseMissionStatus(statusPacket("folder", changes)));
  assert.throws(() => parseMissionStatus({ ...statusPacket(), age_ms: -1 }));
  assert.throws(() =>
    parseMissionStatus({ ...statusPacket(), source_topic: "/odom" })
  );
});

test("measured wheel progress is shown honestly without creating an ACK-based retry", () => {
  const packet=statusPacket("after19",{source:"wheel_feedback",phase:"maze",tasks:Object.fromEntries(retryTasks.map(task=>[task.id,"pending"]))});
  const parsed=parseMissionStatus(packet);
  assert.equal(parsed.state.source,"wheel_feedback");
  const retry=retryFromMissionStatus(retryRoute,retryRack,{},parsed,true);
  assert.equal(retry.plan,null);
  assert.match(retry.errors[0],/ACK/);
  packet.state.tasks["sheet.pick"]="completed";
  assert.throws(()=>parseMissionStatus(packet));
});

test("START speed and tolerance stay optional for old drafts and validate new saved values",()=>{
 const {validExecutionSettings,DEFAULT_EXECUTION_SETTINGS:d}=load('utils/mainprogramSettings.ts');
 assert.equal(d.approach_speed_mps,.75);assert.equal(d.approach_tolerance_m,.1);
 const legacy={...d};delete legacy.approach_speed_mps;delete legacy.approach_tolerance_m;
 assert.equal(validExecutionSettings(legacy),true);
 assert.equal(validExecutionSettings({...legacy,approach_speed_mps:1.3,approach_tolerance_m:.025}),true);
 for(const key of ['approach_speed_mps','approach_tolerance_m'])
  for(const bad of [null,true,NaN,Infinity,0,-1,'1'])assert.equal(validExecutionSettings({...legacy,[key]:bad}),false);
 assert.equal(validExecutionSettings({...legacy,approach_speed_mps:10000}),false);
 assert.equal(validExecutionSettings({...legacy,approach_tolerance_m:.401}),false);
});

test("unmatched plan or missing/unknown task ACKs cannot skip station work", () => {
  const mismatch = retryFromMissionStatus(
    retryRoute,
    retryRack,
    {},
    parseMissionStatus(statusPacket("folder", { plan_key: "another-plan" })),
    true
  );
  assert.equal(mismatch.plan, null);
  const partial = statusPacket("folder");
  delete partial.state.tasks["sheet.pick"];
  assert.equal(
    retryFromMissionStatus(
      retryRoute,
      retryRack,
      {},
      parseMissionStatus(partial),
      true
    ).plan,
    null
  );
  const inFlight = statusPacket("folder");
  inFlight.state.tasks["sheet.fold"] = "in_progress";
  assert.ok(
    retryFromMissionStatus(
      retryRoute,
      retryRack,
      {},
      parseMissionStatus(inFlight),
      true
    ).errors.length
  );
});

test("running, idle, unstopped and stale mission states cannot open a retry review", () => {
  for (const changes of [
    { run_state: "running" },
    { run_state: "idle" },
    { stopped: false },
    { run_state: "completed" },
  ])
    assert.ok(
      retryFromMissionStatus(
        retryRoute,
        retryRack,
        {},
        parseMissionStatus(statusPacket("after19", changes)),
        true
      ).errors.length
    );
  assert.ok(
    retryFromMissionStatus(
      retryRoute,
      retryRack,
      {},
      parseMissionStatus(statusPacket()),
      false
    ).errors.length
  );
});

test("retry review survives heartbeats but is invalidated by progress, run or pose changes", () => {
  const state = parseMissionStatus(statusPacket()).state;
  assert.equal(
    missionReviewKey(state),
    missionReviewKey({
      ...state,
      sequence: 99,
      tasks: Object.fromEntries(Object.entries(state.tasks).reverse()),
    })
  );
  for (const changes of [
    { highest_reached: 24 },
    { pose_epoch: "pose-new" },
    { run_id: "run-new" },
    { stopped: false },
    { block_dropped: false },
  ])
    assert.notEqual(
      missionReviewKey(state),
      missionReviewKey({ ...state, ...changes })
    );
});
const buildRetry = (
  snapshot,
  dropped = false,
  route = retryRoute,
  selection = retryRack,
  settings = {}
) => buildRetryPlan(route, selection, settings, snapshot, dropped);

test("route deletion cannot create a gap or silently truncate the stored tail", () => {
  const middle = routeAfterDeletion(retryRoute, ["7,1"]);
  assert.equal(middle.removed.length, 1);
  assert.equal(middle.remaining.length, 36);
  assert.match(middle.error, /ขาด/);
  assert.match(routeAfterDeletion(retryRoute, ["7,0"]).error, /A8/);
  assert.equal(retryRoute.length, 37);
});

test("confirmed suffix/bulk/all deletions keep a restorable continuous prefix", () => {
  const keys = retryRoute.slice(24).map((cell) => `${cell.row},${cell.col}`);
  const deleted = routeAfterDeletion(retryRoute, keys);
  assert.equal(deleted.error, "");
  assert.deepEqual(deleted.remaining, retryRoute.slice(0, 24));
  assert.equal(
    routeAfterDeletion(
      retryRoute,
      retryRoute.map((cell) => `${cell.row},${cell.col}`)
    ).error,
    ""
  );
  assert.ok(routeAfterDeletion(retryRoute, []).error);
});

test("retry boundary is highest confirmed arrival 18 vs 19, in every preset", () => {
  for (const { route } of MAZE_PRESETS) {
    const key = missionPlanKey(route, retryRack, {});
    const before = retryScenario(key, retryTasks, "before19");
    const first = buildRetry(before, true, route);
    assert.deepEqual(first.errors, []);
    assert.equal(first.destination, "start");
    assert.equal(first.movement.include_external_start_approach, true);
    assert.equal(first.movement.route_sequences[0], 1);
    const second = buildRetry({ ...before, highest_reached: 19 }, true, route);
    assert.deepEqual(second.errors, []);
    assert.equal(second.destination, "checkpoint19");
    assert.equal(second.movement.anchor.cell, cellLabel(route[18]));
    assert.equal(second.movement.route_sequences[0], 19);
    assert.equal(second.movement.include_external_start_approach, false);
    assert.equal(second.executable, false);
    assert.equal(second.skip_cabinet1, true);
    assert.ok(!second.pending_tasks.some((task) => task.id === "blocks.pick"));
    assert.equal(
      second.recovery_actions[0].action,
      "request_all_block_gripper_magnets_on"
    );
    assert.ok(
      second.recovery_actions[0].requires.includes("stationary_controller_ack")
    );
  }
});

test("folder retry skips placed blocks and resumes exactly the pending sheet subtask", () => {
  const snapshot = retryScenario(retryKey, retryTasks, "folder");
  const plan = buildRetry(snapshot);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.destination, "folder");
  assert.equal(plan.skip_cabinet2, true);
  assert.deepEqual(plan.movement.route_sequences, []);
  assert.deepEqual(
    plan.pending_tasks.map((task) => task.id),
    ["sheet.fold", "sheet.collect"]
  );
  const folded = buildRetry({
    ...snapshot,
    completed: [...snapshot.completed, "sheet.fold"],
  });
  assert.deepEqual(
    folded.pending_tasks.map((task) => task.id),
    ["sheet.collect"]
  );
});

test("partial cabinet2 placements do not replay completed block placements", () => {
  const base = retryScenario(retryKey, retryTasks, "after19");
  const placement = retryTasks.find((task) => task.station === "cabinet2");
  const plan = buildRetry({
    ...base,
    phase: "cabinet2",
    completed: [...base.completed, placement.id],
  });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.destination, "cabinet2");
  assert.ok(!plan.pending_tasks.some((task) => task.id === placement.id));
  assert.equal(plan.tracks.blocks.pending.length, 2);
});

test("sheet pickup is independent and cannot be silently satisfied by block regrip", () => {
  const base = retryScenario(retryKey, retryTasks, "before19");
  const snapshot = {
    ...base,
    completed: base.completed.filter((id) => id !== "sheet.pick"),
  };
  const before = buildRetry(snapshot, true);
  assert.deepEqual(before.errors, []);
  assert.equal(before.skip_cabinet1, false);
  assert.ok(before.tracks.sheet.pending.includes("sheet.pick"));
  assert.ok(
    buildRetry({ ...snapshot, highest_reached: 19 }, true).errors.length
  );
});

test("unknown actuator result and contradictory dependencies hold retry for reconciliation", () => {
  const base = retryScenario(retryKey, retryTasks, "folder");
  assert.ok(buildRetry({ ...base, uncertain: ["sheet.fold"] }).errors.length);
  assert.ok(
    buildRetry({
      ...base,
      completed: base.completed.filter((id) => id !== "sheet.pick"),
    }).errors.length
  );
  assert.ok(
    buildRetry({
      ...base,
      completed: [...base.completed, "sheet.fold"],
      uncertain: ["sheet.fold"],
    }).errors.length
  );
  assert.ok(
    buildRetry({
      ...base,
      completed: base.completed.filter((id) => !id.startsWith("blocks.place.")),
    }).errors.length
  );
});

test("old progress cannot transfer to a changed route, speed, rack selection or sheet", () => {
  const base = retryScenario(retryKey, retryTasks, "after19");
  assert.ok(buildRetry(base, false, MAZE_PRESETS[1].route).errors.length);
  assert.ok(
    buildRetry(base, false, retryRoute, { ...retryRack, plate: 2 }).errors
      .length
  );
  assert.ok(
    buildRetry(base, false, retryRoute, { ...retryRack, color: "blue" }).errors
      .length
  );
  assert.ok(
    buildRetry(base, false, retryRoute, retryRack, {
      "7,0": {
        speed_mps: 0.5,
        position_tolerance_m: 0.02,
        heading_deg: null,
        heading_tolerance_deg: 3,
      },
    }).errors.length
  );
});

test("invalid counts, wrong ledger tasks and unfinished finished states are blocked", () => {
  const base = emptyRetrySnapshot(retryKey);
  for (const value of [-1, 38, 18.5, NaN])
    assert.ok(buildRetry({ ...base, highest_reached: value }).errors.length);
  assert.ok(buildRetry({ ...base, completed: ["unknown-task"] }).errors.length);
  assert.ok(buildRetry({ ...base, phase: "finished" }).errors.length);
  assert.ok(buildRetry(base, true).errors.length);
});

test("all completed work has no retry movement or task replay", () => {
  const snapshot = {
    ...retryScenario(retryKey, retryTasks, "folder"),
    phase: "finished",
    completed: retryTasks.map((task) => task.id),
  };
  const plan = buildRetry(snapshot);
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.destination, "finished");
  assert.deepEqual(plan.movement.route_sequences, []);
  assert.deepEqual(plan.pending_tasks, []);
  assert.ok(buildRetry(snapshot, true).errors.length);
});

test("retry validates effective waypoint values even when the plan key matches", () => {
  const settings = {
    "7,0": {
      speed_mps: Infinity,
      position_tolerance_m: 0.02,
      heading_deg: null,
      heading_tolerance_deg: 3,
    },
  };
  const key = missionPlanKey(retryRoute, retryRack, settings);
  const plan = buildRetry(
    retryScenario(key, retryTasks, "after19"),
    false,
    retryRoute,
    retryRack,
    settings
  );
  assert.ok(plan.errors.some((error) => error.includes("ความเร็ว")));
  assert.equal(plan.executable, false);
});

test("SE2 reanchor accounts for both translation and heading, without moving the robot", () => {
  assert.deepEqual(
    previewMapToOdom({ x: 7, y: 4, yaw: 0 }, { x: 0, y: 0, yaw: 0 }),
    { x: 7, y: 4, yaw: 0 }
  );
  const odom = { x: 2, y: 3, yaw: -0.6 },
    map = { x: 7, y: 4, yaw: 1.2 };
  const transform = previewMapToOdom(map, odom);
  close(
    transform.x +
      Math.cos(transform.yaw) * odom.x -
      Math.sin(transform.yaw) * odom.y,
    map.x
  );
  close(
    transform.y +
      Math.sin(transform.yaw) * odom.x +
      Math.cos(transform.yaw) * odom.y,
    map.y
  );
  close(transform.yaw + odom.yaw, map.yaw);
  assert.throws(() => previewMapToOdom({ x: NaN, y: 0, yaw: 0 }, odom));
});

test("robot profile matches the supplied 66 x 66 x 100 cm envelope", () => {
  assert.equal(ROBOT_PROFILE.width_m, 0.66);
  assert.equal(ROBOT_PROFILE.depth_m, 0.66);
  assert.equal(ROBOT_PROFILE.height_m, 1);
  for (let phase = 0; phase < 8; phase++) {
    const points = robotGeometry((phase * Math.PI) / 32).faces.flatMap(
      (f) => f.points
    );
    for (const [x, y, z] of points) {
      assert.ok(Math.abs(x) <= 0.33000001, `width exceeds envelope: ${x}`);
      assert.ok(Math.abs(y) <= 0.33000001, `depth exceeds envelope: ${y}`);
      assert.ok(z >= 0 && z <= 1.00000001, `height exceeds envelope: ${z}`);
    }
  }
});

for (const preset of MAZE_PRESETS)
  test(`${preset.id}: continuous approach, 37 cells, fixed heading and right-side finish`, () => {
    const plan = makeSimulationPlan(preset.route);
    assert.equal(plan.valid, true);
    assert.equal(plan.points.length, 40);
    assert.match(plan.points[0].label, /A6/);
    assert.equal(plan.points.at(-1).label, "FINISH");
    assert.deepEqual(
      plan.points.slice(2, -1).map((p) => p.label),
      preset.route.map(cellLabel)
    );
    for (let i = 0; i < plan.legs.length; i++) {
      const leg = plan.legs[i];
      assert.equal(leg.kind, "move");
      close(leg.from.heading, Math.PI / 2);
      close(leg.to.heading, Math.PI / 2);
      assert.ok(leg.duration > 0);
      if (i) {
        const prev = plan.legs[i - 1];
        close(prev.start + prev.duration, leg.start);
        assert.deepEqual(prev.to, leg.from);
      }
      if (leg.kind === "turn") {
        close(leg.from.x, leg.to.x);
        close(leg.from.y, leg.to.y);
        assert.ok(Math.abs(leg.to.heading - leg.from.heading) <= Math.PI);
      }
      const middle = sampleSimulation(plan, leg.start + leg.duration / 2).pose;
      close(middle.x, (leg.from.x + leg.to.x) / 2);
      close(middle.y, (leg.from.y + leg.to.y) / 2);
    }
    const end = sampleSimulation(plan, plan.duration + 100);
    assert.equal(end.done, true);
    assert.ok(end.pose.x > 8 * CELL_METERS);
    assert.deepEqual(sampleSimulation(plan, -1).pose, plan.initial);
  });

test("empty, disconnected, repeated and out-of-bounds paths cannot play", () => {
  for (const route of [
    [],
    [
      { row: 7, col: 0 },
      { row: 7, col: 2 },
    ],
    [
      { row: 7, col: 0 },
      { row: 7, col: 1 },
      { row: 7, col: 0 },
    ],
    [{ row: 8, col: 0 }],
  ]) {
    const plan = makeSimulationPlan(route);
    assert.equal(plan.valid, false);
    assert.equal(plan.duration, 0);
    assert.equal(sampleSimulation(plan, 100).done, false);
  }
});

test("partial routes do not invent an exit and input selections are not mutated", () => {
  const route = MAZE_PRESETS[0].route.slice(0, 5);
  const before = JSON.stringify(route);
  const plan = makeSimulationPlan(route);
  assert.equal(plan.points.at(-1).label, cellLabel(route.at(-1)));
  assert.equal(JSON.stringify(route), before);
});

test("photographed front is flipped 180 degrees, independently of logical heading", () => {
  const { placeRobot } = load("utils/robotScene.ts");
  const model = {
    faces: [{ color: "#ffffff", points: [[0, -0.3, 0.5]] }],
    labels: [],
  };
  const forward = placeRobot(model, { x: 1, y: 2, heading: 0 }).faces[0]
    .points[0];
  close(forward[0], 1.3);
  close(forward[1], 2);
  const up = placeRobot(model, { x: 1, y: 2, heading: Math.PI / 2 }).faces[0]
    .points[0];
  close(up[0], 1);
  close(up[1], 2.3);
});

test("per-cell speeds apply but stored headings never rotate the mecanum robot", () => {
  const { DEFAULT_WAYPOINT_SETTINGS } = load("utils/waypointSettings.ts");
  const settings = {
    "7,0": { ...DEFAULT_WAYPOINT_SETTINGS, speed_mps: 0.15, heading_deg: 0 },
    "7,1": { ...DEFAULT_WAYPOINT_SETTINGS, heading_deg: 180 },
  };
  const plan = makeSimulationPlan(MAZE_PRESETS[0].route, settings);
  const leg = plan.legs.find((l) => l.kind === "move" && l.label === "A8");
  close(leg.to.heading, Math.PI / 2);
  close(leg.from.heading, Math.PI / 2);
  assert.equal(
    plan.legs.some((l) => l.kind === "turn"),
    false
  );
  for (const l of plan.legs) close(l.to.heading, Math.PI / 2);
  assert.equal(leg.motion, "สไลด์ขวา");
  close(
    leg.duration,
    Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) / 0.15
  );
});

test("preview wall on the right disappears at the real entry gap while yaw stays fixed", () => {
  const { buildPreviewWalls, previewWallReadings } = load("utils/mazeWalls.ts");
  const plan = makeSimulationPlan(MAZE_PRESETS[0].route),
    walls = buildPreviewWalls(MAZE_PRESETS[0].route);
  const initial = previewWallReadings(walls, plan.initial);
  close(initial.find((r) => r.id === "right").distance_m, 0.15);
  assert.equal(initial.find((r) => r.id === "front").distance_m, null);
  const atEntry = previewWallReadings(walls, {
    ...plan.initial,
    y: 7.5 * CELL_METERS,
  });
  assert.equal(atEntry.find((r) => r.id === "right").distance_m, null);
  const inside = previewWallReadings(walls, {
    x: 0.5 * CELL_METERS,
    y: 7.5 * CELL_METERS,
    heading: Math.PI / 2,
  });
  close(
    inside.find((r) => r.id === "front").distance_m,
    (CELL_METERS - 0.66) / 2
  );
  close(
    inside.find((r) => r.id === "rear").distance_m,
    (CELL_METERS - 0.66) / 2
  );
});

test("backwards travel has left/right corridor walls, not four cell-boundary walls", () => {
  const { buildPreviewWalls, previewWallReadings } = load("utils/mazeWalls.ts");
  const { translationLabel } = load("utils/robotSimulation.ts");
  const walls = buildPreviewWalls(MAZE_PRESETS[0].route);
  const readings = previewWallReadings(walls, {
    x: 2.5 * CELL_METERS,
    y: 5.5 * CELL_METERS,
    heading: Math.PI / 2,
  });
  assert.deepEqual(
    readings
      .filter((r) => r.distance_m !== null && r.distance_m < 0.3)
      .map((r) => r.id)
      .sort(),
    ["left", "right"]
  );
  assert.equal(readings.find((r) => r.id === "front").distance_m, null);
  assert.equal(translationLabel(0, -1), "ถอยหลัง");
  assert.equal(translationLabel(1, 0), "สไลด์ขวา");
  assert.equal(translationLabel(-1, 0), "สไลด์ซ้าย");
});

test("preview passages open only between consecutive cells; no duplicate wall segments", () => {
  const { buildPreviewWalls } = load("utils/mazeWalls.ts");
  const route = [
    { row: 7, col: 0 },
    { row: 7, col: 1 },
    { row: 6, col: 1 },
    { row: 6, col: 0 },
    { row: 5, col: 0 },
  ];
  const walls = buildPreviewWalls(route);
  assert.equal(
    walls.some((w) => w.id === "0,7:1,7"),
    true
  );
  assert.equal(
    walls.some((w) => w.id === "1,7:1,8"),
    false
  );
  assert.equal(new Set(walls.map((w) => w.id)).size, walls.length);
});

test("parameter limits, invalid drafts, and mission validation cannot bypass safety checks", () => {
  const {
    DEFAULT_WAYPOINT_SETTINGS: defaults,
    validWaypointSettings,
    restoreWaypointSettings,
    routeSettingsValid,
  } = load("utils/waypointSettings.ts");
  assert.equal(validWaypointSettings({...defaults,speed_mps:4.7,position_tolerance_m:.4}),true);
  for (const bad of [
    { ...defaults, position_tolerance_m: .4001 },
    { ...defaults, speed_mps: 0 },
    { ...defaults, speed_mps: NaN },
    { ...defaults, speed_mps: Infinity },
    { ...defaults, heading_deg: Infinity },
    { ...defaults, position_tolerance_m: -1 },
    { ...defaults, heading_tolerance_deg: 0 },
  ]) {
    assert.equal(validWaypointSettings(bad), false);
    assert.equal(
      makeSimulationPlan(MAZE_PRESETS[0].route, { "7,0": bad }).valid,
      false
    );
    assert.equal(
      routeSettingsValid(MAZE_PRESETS[0].route, { "7,0": bad }),
      false
    );
  }
  const restored = restoreWaypointSettings({
    "7,0": defaults,
    "9,0": defaults,
    "7,1": {},
  });
  assert.deepEqual(Object.keys(restored), ["7,0"]);
  assert.equal(routeSettingsValid(MAZE_PRESETS[0].route, undefined), true);
});

test("four midpoint ToFs require explicit channel order and unit confirmation", () => {
  const { defaultTofConfig, tofReadings, validTofConfig, tofCentimeters } =
    load("utils/tofTelemetry.ts");
  const packet = {
    raw_values: [100, 200, 300, 400],
    fresh: true,
    sequence: 1,
    age_ms: 0,
    publisher_count: 1,
  };
  const config = defaultTofConfig();
  assert.equal(config.unit, "mm");
  assert.equal(tofCentimeters(85, config.unit), 8.5);
  assert.equal(tofCentimeters(0, config.unit), null);
  assert.deepEqual(Object.values(config.mapping), [null, null, null, null]);
  assert.equal(
    tofReadings(packet, config, true).every((r) => r.meters === null),
    true
  );
  config.unit = "mm";
  config.confirmed = true;
  assert.equal(validTofConfig(config), false);
  config.mapping = { front: 0, rear: 1, left: 2, right: 3 };
  assert.equal(validTofConfig(config), true);
  const readings = tofReadings(packet, config, true);
  close(readings[0].meters, 0.1);
  assert.equal(readings.length, 4);
  close(readings[1].meters, 0.2);
  close(readings[2].meters, 0.3);
  close(readings[3].meters, 0.4);
  assert.equal(
    tofReadings({ ...packet, raw_values: [1, 2, 3, 4, 5] }, config, true).every(
      (r) => r.meters === null
    ),
    true
  );
  config.mapping.rear = 0;
  assert.equal(validTofConfig(config), false);
});

test("stale, invalid or zero ToF is never displayed as a valid zero clearance", () => {
  const { defaultTofConfig, tofReadings, parseTofPacket, restoreTofConfig } =
    load("utils/tofTelemetry.ts");
  const config = {
    ...defaultTofConfig(),
    unit: "mm",
    confirmed: true,
    mapping: { front: 0, rear: 1, left: 2, right: 3 },
  };
  const packet = parseTofPacket({
    raw_values: [NaN, -1, 0, 20],
    fresh: true,
    sequence: 1,
    age_ms: 0,
    publisher_count: 1,
  });
  assert.deepEqual(packet.raw_values, [null, -1, 0, 20]);
  const readings = tofReadings(packet, config, true);
  assert.equal(
    readings.slice(0, 3).every((r) => r.meters === null),
    true
  );
  close(readings[3].meters, 0.02);
  assert.equal(
    tofReadings(packet, config, false).every((r) => r.meters === null),
    true
  );
  assert.equal(restoreTofConfig({ mapping: "invalid" }).confirmed, false);
  assert.equal(restoreTofConfig({}).unit, "mm");
  const legacy = {
    unit: "mm",
    confirmed: true,
    mapping: {
      front: 0,
      left_front: 1,
      left_rear: 2,
      right_front: 3,
      right_rear: 4,
      rear: null,
    },
  };
  assert.equal(restoreTofConfig(legacy).confirmed, false);
  assert.deepEqual(Object.values(restoreTofConfig(legacy).mapping), [
    null,
    null,
    null,
    null,
  ]);
});

test("pattern 1 copies only the nine configured cell names and leaves the rest at defaults", () => {
  const {validWaypointSettings,settingsForCell,DEFAULT_WAYPOINT_SETTINGS}=load("utils/waypointSettings.ts");
  const preset=MAZE_PRESETS[0];
  const expected={A8:[.10,0],B8:[.10,0],C8:[.10,.20],C7:[.20,0],C6:[.20,0],C5:[.20,.20],D5:[.10,0],E5:[.10,0],F5:[.10,.20]};
  assert.equal(Object.keys(preset.waypointSettings).length,9);
  for(const cell of preset.route){
    const setting=preset.waypointSettings[`${cell.row},${cell.col}`];
    const pair=expected[`${String.fromCharCode(65+cell.col)}${cell.row+1}`];
    if(pair) {
      assert(validWaypointSettings(setting));assert.equal(setting.speed_mps,.75);
      assert.equal(setting.heading_deg,90);assert.equal(setting.heading_tolerance_deg,3);
      assert.deepEqual([setting.position_tolerance_m,setting.distance_offset_m],pair);
    } else {
      assert.equal(setting,undefined);
      assert.deepEqual(settingsForCell(preset.waypointSettings,cell),DEFAULT_WAYPOINT_SETTINGS);
    }
  }
  assert.equal(MAZE_PRESETS.slice(1).some(p=>p.waypointSettings),false);
});

test("the former inferred settings are removed while user edits and the nine copied cells survive",()=>{
  const {removeInferredPattern1Settings}=load("utils/mazePresets.ts");
  const {DEFAULT_WAYPOINT_SETTINGS}=load("utils/waypointSettings.ts");
  const saved={...MAZE_PRESETS[0].waypointSettings,
    '5,5':{speed_mps:.75,position_tolerance_m:.20,heading_deg:90,heading_tolerance_deg:3,distance_offset_m:0},
    '6,5':{...DEFAULT_WAYPOINT_SETTINGS,speed_mps:.55}};
  const clean=removeInferredPattern1Settings(saved);
  assert.equal(clean['5,5'],undefined);assert.equal(clean['6,5'].speed_mps,.55);
  assert.equal(clean['7,2'].distance_offset_m,.20);
});

test("X/Y offsets persist in map axes and stop-here chooses the earliest selected cell",()=>{
  const {DEFAULT_WAYPOINT_SETTINGS:d,restoreWaypointSettings,correctedWaypointPositions,validWaypointSettings,executionRoute}=load('utils/waypointSettings.ts');
  const route=[{row:7,col:0},{row:7,col:1},{row:7,col:2},{row:6,col:2}];
  const settings=restoreWaypointSettings({'7,2':{...d,distance_offset_m:.2,distance_offset_axis:'x',stop_here:true},'6,2':{...d,distance_offset_m:-.15,distance_offset_axis:'y',stop_here:true}});
  const p=correctedWaypointPositions(route,settings,.954);
  close(p[2].x,2.585);close(p[3].x,p[2].x);close(p[3].y-p[2].y,-1.104);
  assert.equal(settings['6,2'].distance_offset_axis,'y');assert.equal(settings['7,2'].stop_here,true);
  assert.equal(executionRoute(route,settings).length,3);assert.equal(executionRoute(route,{}).length,4);
  assert.equal(validWaypointSettings({...d,distance_offset_axis:'z'}),false);
  assert.equal(validWaypointSettings({...d,stop_here:1}),false);
});

test("pre-entry X/Y corrections validate and translate later waypoint coordinates together",()=>{
  const {validExecutionSettings,DEFAULT_EXECUTION_SETTINGS:d}=load('utils/mainprogramSettings.ts');
  const {correctedWaypointPositions}=load('utils/waypointSettings.ts');
  assert(validExecutionSettings({...d,approach_offset_x_m:.1,approach_offset_y_m:-.2}));
  for(const value of [null,NaN,Infinity,.51,-.51,'0']) assert.equal(validExecutionSettings({...d,approach_offset_x_m:value}),false);
  const route=[{row:7,col:0},{row:7,col:1}];
  const p=correctedWaypointPositions(route,{},.954,.1,-.2);
  close(p[0].x,.577);close(p[0].y,7.5*.954-.2);close(p[1].x-p[0].x,.954);close(p[1].y,p[0].y);
});

test("a selected stop on the last cell still omits the outside finish movement",()=>{
  const {DEFAULT_WAYPOINT_SETTINGS:d}=load('utils/waypointSettings.ts');
  const plan=makeSimulationPlan(MAZE_PRESETS[0].route,{'0,7':{...d,stop_here:true}});
  assert.equal(plan.points[plan.points.length-1].label,'H1');
  assert.equal(plan.points.some(p=>p.label==='FINISH'),false);
});

test("separate X/Y inputs persist together and replace the legacy single-axis correction",()=>{
  const {DEFAULT_WAYPOINT_SETTINGS:d,restoreWaypointSettings,correctedWaypointPositions,waypointOffset,validWaypointSettings}=load('utils/waypointSettings.ts');
  const route=[{row:7,col:0},{row:7,col:1},{row:7,col:2},{row:6,col:2}];
  const settings=restoreWaypointSettings({'7,1':{...d,distance_offset_m:.4,distance_offset_axis:'x',distance_offset_x_m:.1,distance_offset_y_m:.05},'7,2':{...d,distance_offset_x_m:-.05,distance_offset_y_m:-.03}});
  const p=correctedWaypointPositions(route,settings,.954);
  close(p[1].x,1.531);close(p[1].y,7.205);close(p[2].x,2.435);close(p[2].y,7.175);close(p[3].x,2.435);close(p[3].y,6.221);
  assert.deepEqual(waypointOffset({...d,distance_offset_m:.2},0,-1),{x:0,y:-.2});
  assert.deepEqual(waypointOffset({...d,distance_offset_m:.2,distance_offset_x_m:0,distance_offset_y_m:0},1,0),{x:0,y:0});
  for(const value of [null,NaN,Infinity,.51,-.51]) assert.equal(validWaypointSettings({...d,distance_offset_x_m:value}),false);
});

test("robot-frame input X is forward and Y is left while old map targets remain unchanged",()=>{
  const {mapOffsetToRobot,robotOffsetToMap}=load('utils/offsetFrames.ts');
  assert.deepEqual(mapOffsetToRobot(.2,0),{x:0,y:-.2});
  assert.deepEqual(robotOffsetToMap(.1,0),{x:0,y:.1});
  assert.deepEqual(robotOffsetToMap(0,.1),{x:-.1,y:0});
  for(const old of [{x:.2,y:-.1},{x:-.15,y:.05},{x:0,y:0}]) {
    const shown=mapOffsetToRobot(old.x,old.y),stored=robotOffsetToMap(shown.x,shown.y);
    close(stored.x,old.x);close(stored.y,old.y);
  }
  for(const yaw of [0,.8,-1.2]) {
    const map=robotOffsetToMap(.1,.2),rotation=yaw-Math.PI/2;
    const worldX=Math.cos(rotation)*map.x-Math.sin(rotation)*map.y;
    const worldY=Math.sin(rotation)*map.x+Math.cos(rotation)*map.y;
    close(worldX*Math.cos(yaw)+worldY*Math.sin(yaw),.1);
    close(-worldX*Math.sin(yaw)+worldY*Math.cos(yaw),.2);
  }
});

test("signed distance adjustments persist, migrate the old C8 correction and move later targets", () => {
  const {restoreWaypointSettings,settingsForCell,correctedWaypointPositions,DEFAULT_WAYPOINT_SETTINGS,validWaypointSettings}=load("utils/waypointSettings.ts");
  const route=[{row:7,col:0},{row:7,col:1},{row:6,col:1},{row:6,col:2}];
  const settings=restoreWaypointSettings({"7,1":{...DEFAULT_WAYPOINT_SETTINGS,distance_offset_m:.2},"6,1":{...DEFAULT_WAYPOINT_SETTINGS,distance_offset_m:-.1}});
  const p=correctedWaypointPositions(route,settings,.954);
  close(p[1].x-p[0].x,1.154);close(p[2].y-p[1].y,-.854);
  close(p[2].x,p[1].x);close(p[3].x-p[2].x,.954);close(p[3].y,p[2].y);
  assert.equal(settingsForCell(restoreWaypointSettings(JSON.parse(JSON.stringify(settings))),route[1]).distance_offset_m,.2);
  const three=[{row:7,col:0},{row:7,col:1},{row:7,col:2}];
  assert.equal(restoreWaypointSettings({},three)["7,2"].distance_offset_m,.2);
  assert.equal(restoreWaypointSettings({"7,2":{...DEFAULT_WAYPOINT_SETTINGS,distance_offset_m:0}},three)["7,2"].distance_offset_m,0);
  for(const value of [NaN,Infinity,.51,-.51,null]) assert.equal(validWaypointSettings({...DEFAULT_WAYPOINT_SETTINGS,distance_offset_m:value}),false);
});

test("mission API validates waypoint values before proxying movement commands", async () => {
  const handler = load("src/pages/api/maze/start.ts").default;
  const request = {
    method: "POST",
    body: {
      route: MAZE_PRESETS[0].route,
      rack_selection: { plate: 1, color: "red", picks: [{ row: 0, col: 0 }] },
      execution_settings: {cell_m:.954,start_mode:"outside_a6",outside_clearance_m:.45,exit_clearance_m:0},
      waypoint_settings: {"7,0":{...load("utils/waypointSettings.ts").DEFAULT_WAYPOINT_SETTINGS,distance_offset_m:.10}},
    },
  };
  const response = {
    statusCode: 0,
    data: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    },
  };
  const originalFetch=global.fetch;
  let calls=0;
  global.fetch=async (url,options)=>{
    calls++;
    assert.equal(JSON.parse(options.body).waypoint_settings["7,0"].distance_offset_m,.10);
    return {status:202,json:async()=>({status:"accepted"})};
  };
  try { await handler(request,response); } finally { global.fetch=originalFetch; }
  assert.equal(response.statusCode,202);assert.equal(calls,1);
  request.body.waypoint_settings = { "7,0": { speed_mps: NaN } };
  await handler(request, response);
  assert.equal(response.statusCode, 400);
  assert.equal(
    response.data.checks.find((c) => c.id === "waypoint-settings").passed,
    false
  );
});
