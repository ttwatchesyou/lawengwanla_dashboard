const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs"),
  path = require("node:path"),
  ts = require("typescript");
const cache = {};
function load(name) {
  const file = path.resolve(__dirname, "../utils", name + ".ts");
  if (cache[file]) return cache[file].exports;
  const mod = (cache[file] = { exports: {} });
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) => (name.startsWith(".") ? load(name.slice(2)) : require(name)),
    mod,
    mod.exports
  );
  return mod.exports;
}
const { liveTurboFrame, turboLoad, SILENT_TURBO, FINISHED_TURBO } =
  load("turboAudio");
const { makeTurboSimulation, simulationTurboFrame } = load("turboSimulation");
const { DEFAULT_EXECUTION_SETTINGS: config } = load("mainprogramSettings");
const { DEFAULT_WAYPOINT_SETTINGS } = load("waypointSettings");
const state = {
  status: "RUN",
  pose: [3, 4, 0],
  twist_world: [0.3, 0.4, 0],
  target: { x: 6, y: 8, tolerance: 0.02 },
  distance_m: 999,
};
test("live sound uses measured speed and controller target distance, ignoring total mission length", () => {
  const frame = liveTurboFrame(state, true);
  assert.equal(frame.speed, 0.5);
  assert.equal(frame.distance, 4.98);
  assert.equal(frame.moving, true);
  assert.equal(liveTurboFrame({ ...state, pose: [6, 8, 0] }, true).distance, 0);
});
test("stop, stale data, missing target, holding and zero measured speed silence audio", () => {
  for (const status of ["IDLE", "STOPPING", "ERROR", "DONE"])
    assert.deepEqual(liveTurboFrame({ ...state, status }, true), SILENT_TURBO);
  assert.deepEqual(liveTurboFrame(state, false), SILENT_TURBO);
  assert.deepEqual(
    liveTurboFrame({ ...state, target: { label: "A8" } }, true),
    SILENT_TURBO
  );
  assert.deepEqual(
    liveTurboFrame({ ...state, position_holding: true }, true),
    SILENT_TURBO
  );
  assert.equal(
    turboLoad(liveTurboFrame({ ...state, twist_world: [0, 0, 0] }, true)),
    0
  );
});
test("turbo winds down near a stop and responds to measured speed", () => {
  const frame = { moving: true, distance: 2, speed: 0.7 };
  assert.equal(turboLoad(frame), 1);
  assert.ok(turboLoad({ ...frame, distance: 0.1 }) < turboLoad(frame));
  assert.ok(turboLoad({ ...frame, speed: 0.1 }) < turboLoad(frame));
  assert.equal(turboLoad({ ...frame, distance: 0 }), 0);
  assert.equal(turboLoad({ ...frame, speed: NaN }), 0);
});
const route = [
  { col: 0, row: 7 },
  { col: 1, row: 7 },
  { col: 2, row: 7 },
  { col: 2, row: 6 },
];
test("simulation follows configured metric approach and truncates at stop_here", () => {
  const plan = makeTurboSimulation(
    route,
    { "7,1": { ...DEFAULT_WAYPOINT_SETTINGS, stop_here: true } },
    { ...config, cell_m: 1, outside_clearance_m: 0.4, approach_offset_x_m: 0.1 }
  );
  assert.ok(plan.valid);
  assert.equal(plan.initial.x, -0.4);
  assert.equal(plan.initial.y, 5.5);
  assert.ok(Math.abs(plan.legs[0].to.x + 0.3) < 1e-9);
  assert.equal(plan.points.at(-1).label, "B8");
  assert.ok(Math.abs(plan.points.at(-1).x - 1.6) < 1e-9);
});
test("straight cells share remaining distance; corners and completion release the turbo", () => {
  const plan = makeTurboSimulation(
    route,
    {},
    { ...config, start_mode: "at_entry", cell_m: 1 }
  );
  assert.equal(plan.legs.length, 3);
  assert.equal(simulationTurboFrame(plan, 0).distance, 2);
  const first = plan.legs[0];
  const before = simulationTurboFrame(plan, first.duration - 0.001).distance;
  const after = simulationTurboFrame(plan, first.duration + 0.001).distance;
  assert.ok(Math.abs(before - after) < 0.01);
  const corner = plan.legs[1];
  assert.ok(
    simulationTurboFrame(plan, corner.start + corner.duration - 0.01).distance <
      0.01
  );
  assert.deepEqual(simulationTurboFrame(plan, plan.duration), FINISHED_TURBO);
  assert.equal(makeTurboSimulation([], {}, config).valid, false);
});

const { TurboDynamics } = load("turboAudio");
test("rotor spools with inertia and releases once during gradual lift-off", () => {
  const dynamics = new TurboDynamics();
  const full = { moving: true, speed: 0.7, distance: 2 };
  const first = dynamics.step(full, 0);
  assert.ok(first.spool > 0 && first.spool < 0.3);
  let result;
  for (let i = 1; i <= 40; i++) result = dynamics.step(full, i * 0.05);
  assert.ok(result.spool > 0.99);
  const releases = [];
  for (let i = 1; i <= 60; i++) {
    result = dynamics.step(
      { ...full, distance: Math.max(0.001, 0.65 - i * 0.012) },
      2 + i * 0.05
    );
    if (result.release) releases.push(result.release);
  }
  assert.equal(
    releases.length,
    1,
    "gradual deceleration must produce exactly one valve event"
  );
  assert.ok(releases[0] > 0.8);
  for (let i = 1; i <= 40; i++) dynamics.step(full, 5 + i * 0.05);
  assert.ok(
    dynamics.step({ ...full, distance: 0.01 }, 7.05).release > 0.8,
    "next straight run recharges the valve"
  );
  dynamics.reset();
  assert.equal(
    dynamics.step({ ...full, distance: 0 }, 8).release,
    0,
    "muting/stale data resets pending boost"
  );
});
test("recording assets are local PCM WAVs with non-silent, unclipped samples and source credits", () => {
  for (const name of ["spool-low", "spool-high", "blowoff", "engine"]) {
    const data = fs.readFileSync(
      path.resolve(__dirname, "../public/audio/turbo-v3", name + ".wav")
    );
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.toString("ascii", 8, 12), "WAVE");
    assert.equal(data.readUInt16LE(22), 1);
    assert.equal(data.readUInt32LE(24), 44100);
    let peak = 0;
    for (let i = 44; i + 1 < data.length; i += 2)
      peak = Math.max(peak, Math.abs(data.readInt16LE(i)));
    assert.ok(peak > 1000 && peak < 32700);
    assert.ok(data.length < 200000, "compact local sample");
  }
  const credits = fs.readFileSync(
    path.resolve(__dirname, "../public/audio/turbo-v3/CREDITS.txt"),
    "utf8"
  );
  assert.match(credits, /editboy23/);
  assert.match(credits, /nick7100/);
  assert.match(credits, /CC BY 3.0/);
});

test("only normal completion preserves the release tail; stale, cancelled and faulty runs mute", () => {
  assert.equal(
    liveTurboFrame({ ...state, status: "FINISH" }, true),
    FINISHED_TURBO
  );
  assert.equal(
    liveTurboFrame(
      {
        ...state,
        status: "STOPPING",
        reason: "Route reached; confirming stop",
      },
      true
    ),
    FINISHED_TURBO
  );
  assert.equal(
    liveTurboFrame({ ...state, status: "FINISH" }, false),
    SILENT_TURBO
  );
  assert.equal(
    liveTurboFrame(
      { ...state, status: "STOPPING", reason: "Cancelled by operator" },
      true
    ),
    SILENT_TURBO
  );
  assert.equal(
    liveTurboFrame({ ...state, status: "ERROR" }, true),
    SILENT_TURBO
  );
  assert.equal(
    liveTurboFrame({ ...state, twist_world: [0, 0, 0] }, true).moving,
    false
  );
});

const { engineVoicing } = load("turboAudio");
test("engine lowers RPM and gains a soft low-rev cadence on approach even at unchanged wheel speed", () => {
  const frame = { moving: true, speed: 0.6, distance: 2 };
  const far = engineVoicing(frame);
  const near = engineVoicing({ ...frame, distance: 0.06 });
  assert.ok(near.rate < far.rate * 0.6);
  assert.ok(near.rate >= 0.65);
  assert.ok(near.pulseDepth > far.pulseDepth * 3);
  assert.ok(near.pulseHz < far.pulseHz);
  assert.ok(near.level < far.level);
  let previous = engineVoicing({ ...frame, distance: 1 }).rate;
  for (let distance = 0.99; distance >= 0; distance -= 0.01) {
    const next = engineVoicing({ ...frame, distance }).rate;
    assert.ok(next <= previous + 1e-9);
    assert.ok(
      previous - next < 0.025,
      "approach must ease down without a pitch step"
    );
    previous = next;
  }
});
test("engine does not dip at intermediate straight cells and recovers beyond a corner", () => {
  const plan = makeTurboSimulation(
    route,
    {},
    { ...config, start_mode: "at_entry", cell_m: 1 }
  );
  const firstEnd = plan.legs[0].duration;
  const beforeCell = engineVoicing(
    simulationTurboFrame(plan, firstEnd - 0.001)
  );
  const afterCell = engineVoicing(simulationTurboFrame(plan, firstEnd + 0.001));
  assert.ok(Math.abs(beforeCell.rate - afterCell.rate) < 0.001);
  const corner = plan.legs[1].start + plan.legs[1].duration;
  const beforeCorner = engineVoicing(simulationTurboFrame(plan, corner - 0.01));
  const afterCorner = engineVoicing(simulationTurboFrame(plan, corner + 0.01));
  assert.ok(afterCorner.rate > beforeCorner.rate + 0.3);
});

test("valve vents ahead of the corner at half a metre, once per approach", () => {
  const dynamics = new TurboDynamics();
  const cruise = { moving: true, speed: 0.6, distance: 2 };
  for (let i = 0; i < 60; i++) dynamics.step(cruise, i * 0.05);
  const approach = dynamics.step({ ...cruise, distance: 0.48 }, 3);
  assert.ok(
    approach.release > 0.8,
    "pressure vents before the final few centimetres"
  );
  for (let i = 1; i <= 60; i++) {
    const next = dynamics.step(
      { ...cruise, distance: Math.max(0.001, 0.48 - i * 0.01) },
      3 + i * 0.05
    );
    assert.equal(next.release, 0, "same approach must not repeatedly vent");
  }
  for (let i = 1; i <= 60; i++) dynamics.step(cruise, 6 + i * 0.05);
  assert.ok(
    dynamics.step({ ...cruise, distance: 0.48 }, 9.05).release > 0.8,
    "next span recharges normally"
  );
});

test("holding near a corner does not recharge and retrigger the same valve release", () => {
  const dynamics = new TurboDynamics(),
    cruise = { moving: true, speed: 0.6, distance: 2 };
  for (let i = 0; i < 60; i++) dynamics.step(cruise, i * 0.05);
  assert.ok(dynamics.step({ ...cruise, distance: 0.48 }, 3).release > 0);
  for (let i = 1; i <= 60; i++)
    assert.equal(
      dynamics.step({ ...cruise, distance: 0.48 }, 3 + i * 0.05).release,
      0
    );
  for (let i = 1; i <= 60; i++)
    assert.equal(
      dynamics.step(
        { ...cruise, distance: Math.max(0.001, 0.48 - i * 0.01) },
        6 + i * 0.05
      ).release,
      0
    );
});
