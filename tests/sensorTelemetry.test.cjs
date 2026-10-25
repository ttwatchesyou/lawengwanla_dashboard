const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const moduleUnderTest = { exports: {} };
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, "../utils/sensorTelemetry.ts"), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
new Function("module", "exports", source)(moduleUnderTest, moduleUnderTest.exports);
const { parseTelemetrySnapshot, telemetryIsLive, parseInductivePacket, inductiveIndicators,
  parseLimitPacket, limitIndicators, parseTofReadings } = moduleUnderTest.exports;
const packet = () => ({ schema: "lawengwanla.inductive.v1", board: "uno_r4_minima", sequence: 2,
  uptime_ms: 1000, pins: [2, 3, 4, 5], input_mode: "INPUT_PULLUP", active_low: true, debounce_ms: 10,
  raw: [1, 1, 0, 1], levels: [0, 1, 0, 1], active: [true, false, true, false],
  connected: true, host_epoch: "test", sample_age_ms: 25 });
const snapshot = () => ({ key: "inductive", label: "Inductive", topic: "/sensors/inductive",
  message_type: "std_msgs/msg/String", stale_ms: 1000, sequence: 5, age_ms: 50,
  fresh: true, state: "live", publisher_count: 1, data: packet(), error: null });
const analogPacket = () => ({ ...packet(), pins: [2, 3, "A4", "A5"], input_mode: "INPUT",
  raw: [0, 1, 0, 1], input_valid: [true, true, true, true],
  analog_inputs: [[2,"A4",500],[3,"A5",14000]].map(([index,pin,adc_raw]) =>
    ({index,pin,adc_raw,adc_bits:14,adc_max:16383,low_threshold:12999,high_threshold:13000})) });

test("A4/A5 ADC readings preserve sensor identity, debounce, and per-channel unknown", () => {
  const data = analogPacket();
  assert.equal(parseInductivePacket(data).analog_inputs[1].pin,"A5");
  assert.deepEqual(inductiveIndicators({...snapshot(),data},0),["active","inactive","active","inactive"]);
  data.input_valid[2]=false; data.raw[2]=data.levels[2]=1; data.active[2]=false;
  data.analog_inputs[0].adc_raw=13000;
  assert.deepEqual(inductiveIndicators({...snapshot(),data},0),["active","inactive","unknown","inactive"]);
  assert.deepEqual(inductiveIndicators({...snapshot(),data},1000),Array(4).fill("unknown"));
});

test("malformed ADC metadata cannot render a live inductive reading", () => {
  for (const change of [{adc_raw:-1},{adc_raw:16384},{adc_raw:1.5},{pin:"A5"},{index:3},
    {adc_bits:12},{low_threshold:13000},{high_threshold:12999},{adc_raw:14000}]) {
    const data=analogPacket(); Object.assign(data.analog_inputs[0],change);
    assert.equal(parseInductivePacket(data),null,JSON.stringify(change));
  }
  const data=analogPacket(); delete data.input_valid;
  assert.equal(parseInductivePacket(data),null);
  assert.equal(parseInductivePacket({...analogPacket(),pins:["A5",3,4,"A4"]}),null);
});

test("valid live telemetry and active LOW use debounced levels, not instant raw", () => {
  const value = parseTelemetrySnapshot(snapshot());
  assert.equal(telemetryIsLive(value, 100), true);
  const sensor = parseInductivePacket(value.data);
  assert.equal(sensor.active[0], true);
  assert.equal(sensor.raw[0], 1);
});

test("R4 plain INPUT keeps active LOW while STM32 limits still require pull-up", () => {
  const plain = { ...packet(), input_mode: "INPUT" };
  assert.equal(parseInductivePacket(plain).input_mode, "INPUT");
  assert.deepEqual(inductiveIndicators({ ...snapshot(), data: plain }, 0), ["active", "inactive", "active", "inactive"]);
  assert.equal(parseInductivePacket({ ...plain, input_mode: "OUTPUT" }), null);
  assert.equal(parseInductivePacket({ ...plain, input_mode: "INPUT_PULLDOWN" }), null);
  const levels = Array(10).fill(1);
  assert.equal(parseLimitPacket({ ...plain, schema: "lawengwanla.limit.v1", board: "bluepill_f103c8",
    pins: ["PA11", "PA12", "PA8", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8", "PB9"],
    raw: levels, levels, active: Array(10).fill(false) }), null);
});

test("local elapsed time expires a cached HTTP response even if API says fresh", () => {
  assert.equal(telemetryIsLive(snapshot(), 949), true);
  assert.equal(telemetryIsLive(snapshot(), 950), false);
  assert.equal(telemetryIsLive(snapshot(), 0, true), false);
  assert.equal(telemetryIsLive(null, 0), false);
  assert.equal(telemetryIsLive(snapshot(), -1), false);
});

test("missing duplicate stale disconnected or invalid publishers never show live readings", () => {
  for (const changes of [{ publisher_count: 0 }, { publisher_count: 2 }, { publisher_count: null },
    { fresh: false }, { state: "invalid" }, { state: "disconnected" }, { error: "bad packet" }, { age_ms: null }]) {
    assert.equal(telemetryIsLive({ ...snapshot(), ...changes }, 0), false);
  }
});

test("malformed API envelopes are rejected", () => {
  for (const changes of [{ stale_ms: -1 }, { age_ms: NaN }, { age_ms: -1 }, { sequence: true },
    { publisher_count: -1 }, { fresh: 1 }, { error: {} }]) {
    assert.throws(() => parseTelemetrySnapshot({ ...snapshot(), ...changes }));
  }
});

test("invalid sensor frames and electrical values become unknown", () => {
  for (const changes of [{ connected: false }, { pins: ["2", "3", "4", "5"] }, { pins: [5, 4, 3, 2] },
    { active: [false, false, false, false] }, { active_low: false }, { raw: [true, 1, 0, 1] },
    { levels: [0, 1] }, { host_epoch: "" }, { sample_age_ms: NaN }, { uptime_ms: -1 }]) {
    assert.equal(parseInductivePacket({ ...packet(), ...changes }), null);
  }
  assert.equal(parseInductivePacket(null), null);
});

test("four simple lamps follow debounced active LOW, keeping missing data distinct from OFF", () => {
  assert.deepEqual(inductiveIndicators(snapshot(), 0), ["active", "inactive", "active", "inactive"]);
  const unknown = ["unknown", "unknown", "unknown", "unknown"];
  assert.deepEqual(inductiveIndicators(null, 0), unknown);
  assert.deepEqual(inductiveIndicators(snapshot(), 1000), unknown);
  assert.deepEqual(inductiveIndicators(snapshot(), 0, true), unknown);
  assert.deepEqual(inductiveIndicators({ ...snapshot(), publisher_count: 2 }, 0), unknown);
  assert.deepEqual(inductiveIndicators({ ...snapshot(), key: "tof" }, 0), unknown);
  assert.deepEqual(inductiveIndicators({ ...snapshot(), data: { ...packet(), connected: false } }, 0), unknown);
});

test("ten STM32 limit inputs use the declared pin order and active-low levels", () => {
  const levels = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  const data = { schema: "lawengwanla.limit.v1", board: "bluepill_f103c8", sequence: 1, uptime_ms: 100,
    pins: ["PA11", "PA12", "PA8", "PB3", "PB4", "PB5", "PB6", "PB7", "PB8", "PB9"],
    input_mode: "INPUT_PULLUP", active_low: true, debounce_ms: 10, raw: levels, levels,
    active: levels.map(value => value === 0), connected: true, host_epoch: "test", sample_age_ms: 5 };
  const value = { ...snapshot(), key: "limit", data };
  assert.equal(parseLimitPacket(data).pins[2], "PA8");
  assert.deepEqual(limitIndicators(value, 0), ["active", "inactive", "active", "inactive", "active", "inactive", "active", "inactive", "active", "inactive"]);
  assert.deepEqual(limitIndicators({ ...value, fresh: false }, 0), Array(10).fill("unknown"));
  assert.equal(parseLimitPacket({ ...data, pins: [...data.pins].reverse() }), null);
});

test("analog ToF exposes direct 14-bit ADC raw values only from fresh validated R4 data", () => {
  const tof = [["front", "A2"], ["rear", "A3"], ["left", "A0"], ["right", "A1"]].map(([direction, pin]) =>
    ({ model: "ZW_LRD10-R", direction, pin, adc_bits: 14, adc_max: 16383, adc_raw: 4096 }));
  const data = { ...packet(), schema: "lawengwanla.r4_sensors.v3", tof };
  const value = { ...snapshot(), key: "r4", data };
  assert.deepEqual(parseTofReadings(value, 0)[0], { model: "ZW_LRD10-R", direction: "front", pin: "A2",
    adcRaw: 4096, adcMax: 16383 });
  assert.equal(parseTofReadings({ ...value, publisher_count: 0 }, 0), null);
  const invalid = [...tof]; invalid[0] = { ...invalid[0], adc_raw: 16384 };
  assert.equal(parseTofReadings({ ...value, data: { ...data, tof: invalid } }, 0), null);
});


test("ToF-only firmware displays four ADC values and expires stale or disconnected readings", () => {
  const data = {schema: "lawengwanla.tof.v1", board: "uno_r4_minima", sequence: 1,
    uptime_ms: 50, connected: true, host_epoch: "tof", sample_age_ms: 10,
    tof: [["front", "A2"], ["rear", "A3"], ["left", "A0"], ["right", "A1"]].map(([direction, pin], i) =>
      ({model: "ZW_LRD10-R", direction, pin, adc_bits: 14, adc_max: 16383, adc_raw: i * 4096}))};
  const value = {...snapshot(), key: "r4", data};
  assert.deepEqual(parseTofReadings(value, 0).map(r => r.adcRaw), [0, 4096, 8192, 12288]);
  assert.equal(parseTofReadings(value, 950), null);
  assert.equal(parseTofReadings(value, 0, true), null);
  assert.equal(parseTofReadings({...value, data: {...data, connected: false}}, 0), null);
});


test("shared ToF centimeter conversion agrees with calibration means and rejects invalid ADC", () => {
  const { tofAdcToCentimeters } = moduleUnderTest.exports;
  assert.ok(Math.abs(tofAdcToCentimeters(864) - 50) < 0.01);
  assert.ok(Math.abs(tofAdcToCentimeters(1762) - 100) < 0.01);
  assert.ok(Math.abs(tofAdcToCentimeters(1256) - 71.83) < 0.01);
  for (const adc of [-1, 16384, NaN, Infinity, 1.5]) assert.equal(tofAdcToCentimeters(adc), null);
});


test("rear calibration measures chassis-edge distance and applies mounting offset once", () => {
  const { tofAdcToCentimeters, TOF_MOUNTING_OFFSETS_CM } = moduleUnderTest.exports;
  const edge = adc => tofAdcToCentimeters(adc, "rear") + TOF_MOUNTING_OFFSETS_CM.rear;
  assert.ok(Math.abs(edge(461) - 20.5) < 0.02);
  assert.ok(Math.abs(edge(974) - 50) < 0.03);
  assert.ok(Math.abs(edge(715) - 35) < 0.15);
  for (const direction of ["left"])
    assert.equal(tofAdcToCentimeters(864, direction), tofAdcToCentimeters(864));
});


test("front chassis-edge calibration applies front mounting offset once", () => {
  const { tofAdcToCentimeters, TOF_MOUNTING_OFFSETS_CM } = moduleUnderTest.exports;
  const edge = adc => tofAdcToCentimeters(adc, "front") + TOF_MOUNTING_OFFSETS_CM.front;
  assert.ok(Math.abs(edge(869) - 50) < 0.01);
  assert.ok(Math.abs(edge(1755) - 100) < 0.01);
  assert.ok(Math.abs(edge(1334) - 76.24) < 0.01);
  assert.equal(tofAdcToCentimeters(-1, "front"), null);
});


test("right provisional 30 cm compensation keeps shared slope and adds mounting offset once", () => {
  const { tofAdcToCentimeters, TOF_MOUNTING_OFFSETS_CM } = moduleUnderTest.exports;
  const edge = adc => tofAdcToCentimeters(adc, "right") + TOF_MOUNTING_OFFSETS_CM.right;
  assert.ok(Math.abs(edge(165) - 30) < 0.03);
  assert.ok(Math.abs(edge(172) - 30) < 0.4); // Median of the measured 30 cm sample.
  assert.ok(Math.abs((edge(1063) - edge(165)) -
    (tofAdcToCentimeters(1063, "left") - tofAdcToCentimeters(165, "left"))) < 1e-10);
  for (const adc of [-1, 16384, NaN, Infinity, 1.5])
    assert.equal(tofAdcToCentimeters(adc, "right"), null);
});
