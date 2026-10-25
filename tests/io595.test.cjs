const assert = require("node:assert/strict");
const {test} = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
const target = {exports: {}};
const source = ts.transpileModule(fs.readFileSync(require("node:path").join(__dirname, "../utils/io595.ts"), "utf8"),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017}}).outputText;
new Function("module", "exports", source)(target, target.exports);
const {parseIo595, io595Live, io595SensorsLive, io595RelayLevel, LIMIT_INPUTS, RELAY_GROUPS} = target.exports;
test("relay polarity comes from board feedback, including older active-LOW firmware", () => {
  const high = state(); high.packet.active_level = 1;
  const parsed = parseIo595(high);
  assert.equal(io595RelayLevel(parsed.packet, true), "HIGH");
  assert.equal(io595RelayLevel(parsed.packet, false), "LOW");
  assert.equal(io595RelayLevel(state().packet, true), "LOW");
  const invalid = state(); invalid.packet.active_level = 2;
  assert.equal(parseIo595(invalid), null);
});
test("relay wiring exposes all sixteen channels in physical order", () => {
  assert.deepEqual(RELAY_GROUPS[0].outputs.map(x => x.channel), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(RELAY_GROUPS[1].outputs.map(x => x.channel), [9, 10, 11, 12, 13, 14]);
  assert.deepEqual(RELAY_GROUPS[2].outputs.map(x => [x.output, 1 << (x.channel - 1)]), [["G", 0x4000], ["H", 0x8000]]);
});
const state = () => ({connected: true, ready: true, age_ms: 30, packet: {
  schema: "lawengwanla.io595.v1", board: "bluepill_f103c8", sequence: 10, uptime_ms: 500,
  armed: true, session: "0123456789abcdef", ack: 3, mask: 32768,
  nano_levels: [0, 1, 0, 1], limit_raw: [1, 1, 0, 1, 1, 1, 1, 0], limit_levels: [1, 1, 0, 1, 1, 1, 1, 0]}});
test("floor 3 boot homing accepts only its dedicated channels before UART arm", () => {
  const value = state(); value.ready = false;
  Object.assign(value.packet, {armed: false, session: "", mask: 1, floor3: {
    state: "zero", position: "unknown", active: true, homed: false, center_configured: false, error: ""}});
  assert.ok(parseIo595(value));
  value.packet.mask = 4; assert.equal(parseIo595(value), null);
  value.packet.mask = 1; value.packet.floor3.active = false; assert.equal(parseIo595(value), null);
});
test("floor 2 reports channels 4/3 while concurrent floors are rejected", () => {
  const value = state(); value.packet.mask = 8;
  value.packet.floor2 = {state:"zero", position:"unknown", active:true, homed:false, center_configured:true, error:""};
  assert.ok(parseIo595(value));
  value.packet.mask = 4; value.packet.floor2.state = "center_right";
  assert.ok(parseIo595(value));
  value.packet.floor3 = {...value.packet.floor2};
  assert.equal(parseIo595(value), null);
  delete value.packet.floor3; value.packet.mask = 16;
  assert.equal(parseIo595(value), null);
});
test("floor 1 allows only its channel 5/6 output while active", () => {
  const value = state(); value.packet.mask = 16;
  value.packet.floor1 = {state:"zero", position:"unknown", active:true, homed:false, center_configured:true, error:""};
  assert.ok(parseIo595(value));
  value.packet.mask = 32; value.packet.floor1.state = "center_right";
  assert.ok(parseIo595(value));
  value.packet.mask = 4; assert.equal(parseIo595(value), null);
  value.packet.mask = 32; value.packet.floor2 = {...value.packet.floor1};
  assert.equal(parseIo595(value), null);
});
test("PA0 is L8 and firmware migration leaves its absent reading unknown", () => {
  const eight = parseIo595(state());
  assert.equal(LIMIT_INPUTS[7], "PA0");
  assert.equal(eight.packet.limit_levels[7], 0);
  const old = state(); old.packet.limit_raw.pop(); old.packet.limit_levels.pop();
  assert.equal(parseIo595(old).packet.limit_levels[7], undefined);
});
test("sensor display tolerates brief delay while relay authority expires at 250 ms", () => {
  const parsed = parseIo595(state());
  assert.equal(io595Live(parsed, 400), false);
  assert.equal(io595SensorsLive(parsed, 400), true);
  assert.equal(io595SensorsLive(parsed, 969), true);
  assert.equal(io595SensorsLive(parsed, 970), false);
  assert.equal(io595SensorsLive(null, 0), false);
});
test("new board input identity and channel 16 feedback", () => {
  const parsed = parseIo595(state());
  assert.equal(parsed.packet.mask, 32768);
  assert.deepEqual(parsed.packet.nano_levels, [0, 1, 0, 1]);
  assert.equal(parsed.packet.limit_levels[2], 0);
});
test("front motor feedback is separate from relay mask and rejects powered idle states", () => {
  const value = state(); value.packet.mask = 0;
  value.packet.front = {state:"in",position:"unknown",active:true,homed:false,pwm:716,pwm_percent:70,dir:0,error:""};
  assert.ok(parseIo595(value));
  value.packet.front.state="idle"; value.packet.front.active=false;
  assert.equal(parseIo595(value), null);
  value.packet.front.pwm=0; assert.ok(parseIo595(value));
  value.packet.front.state="center"; assert.equal(parseIo595(value),null);
});
test("stale data becomes unknown even when polling stalls", () => {
  const parsed = parseIo595(state());
  assert.equal(io595Live(parsed, 219), true);
  assert.equal(io595Live(parsed, 220), false);
  assert.equal(io595Live(null, 0), false);
});
test("reject malformed feedback rather than showing an OFF lamp", () => {
  for (const mutate of [s => s.packet.mask = 3, s => s.packet.limit_levels.pop(),
    s => s.packet.nano_levels = [true, 0, 1, 1], s => s.age_ms = -1,
    s => s.packet.armed = false, s => s.packet.board = "uno_r4_minima"]) {
    const value = state(); mutate(value); assert.equal(parseIo595(value), null);
  }
});

test("parallel firmware reports independent outputs and rejects conflicting pairs", () => {
 const v=state(); v.packet.parallel_sliders=true; v.packet.travel_timeout_enabled=false;
 const moving={state:"right",position:"unknown",active:true,homed:false,center_configured:true,error:""};
 Object.assign(v.packet,{floor1:{...moving},floor2:{...moving,state:"left"},floor3:{...moving},mask:41});
 assert.ok(parseIo595(v));
 for(const mask of [43,45,57,105]) {v.packet.mask=mask;assert.equal(parseIo595(v),null);}
 v.packet.mask=41;delete v.packet.parallel_sliders;assert.equal(parseIo595(v),null);
 v.packet.parallel_sliders=true;v.ready=false;v.packet.armed=false;v.packet.session="";
 for(const f of ["floor1","floor2","floor3"])v.packet[f].state="zero";
 v.packet.mask=26;assert.ok(parseIo595(v));
 v.packet.floor1.state="right";assert.equal(parseIo595(v),null);
});
