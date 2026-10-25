const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const load = file => {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, "../utils", file + ".ts"), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
  new Function("module", "exports", "require", code)(module, module.exports, name => load(name.replace("./", "")));
  return module.exports;
};
const { sliderCommandAllowed, SLIDER_WIRING, FRONT_WIRING, frontCommandAllowed } = load("io595Slider");
const state = () => ({ connected: true, ready: true, age_ms: 30, stop_generation: 42, packet: {
  parallel_sliders: true, mask: 0,
  floor1: { active: false, center_configured: true },
  floor2: { active: false, center_configured: true },
  floor3: { active: false, center_configured: false },
} });
test("automatic controls require fresh board feedback and enabled center", () => {
  const value = state();
  assert.equal(sliderCommandAllowed(value, 219, 1, "center"), true);
  assert.equal(sliderCommandAllowed(value, 220, 1, "center"), false);
  assert.equal(sliderCommandAllowed(value, 0, 3, "center"), false);
  assert.equal(sliderCommandAllowed(value, 0, 3, "right"), true);
  value.ready = false;
  assert.equal(sliderCommandAllowed(value, 0, 1, "left"), false);
  assert.equal(sliderCommandAllowed(null, 0, 1, "left"), false);
});
test("manual holds block automatic commands; parallel firmware permits other moving floors", () => {
  const value = state(); value.packet.mask = 8;
  assert.equal(sliderCommandAllowed(value, 0, 1, "right"), false);
  value.packet.floor2.active = true;
  assert.equal(sliderCommandAllowed(value, 0, 1, "right"), true);
  value.packet.parallel_sliders = false;
  assert.equal(sliderCommandAllowed(value, 0, 1, "right"), false);
  assert.equal(sliderCommandAllowed(value, 0, 2, "right"), true);
});
test("new STM32 mapping replaces retired input ordering", () => {
  const levels = [1, 0, 1, 0, 1, 1, 1, 0];
  assert.equal(levels[SLIDER_WIRING[1].left], 0); // PA0 is L8, not retired L3.
  assert.equal(levels[SLIDER_WIRING[1].right], 1);
  assert.equal(levels[SLIDER_WIRING[2].left], 0);
  assert.equal(levels[SLIDER_WIRING[3].left], 0);
  const nano = [1, 0, 0, 1];
  assert.equal(nano[SLIDER_WIRING[1].center], 1);
  assert.equal(nano[SLIDER_WIRING[2].center], 0); // Floor 2 center is I3.
  assert.equal(nano[SLIDER_WIRING[3].center], 0); // Floor 3: Nano A1 -> D3 -> PB1.
});
test("front commands require installed PWM firmware, fresh feedback and no manual hold", () => {
  const value = state();
  assert.equal(frontCommandAllowed(value, 0), false);
  value.packet.front = { active: false };
  assert.equal(frontCommandAllowed(value, 0), true);
  assert.equal(frontCommandAllowed(value, 220), false);
  value.packet.mask = 256;
  assert.equal(frontCommandAllowed(value, 0), false);
  value.packet.mask = 8; value.packet.floor2.active = true;
  assert.equal(frontCommandAllowed(value, 0), true);
  assert.equal(FRONT_WIRING.inLimit, 6); assert.equal(FRONT_WIRING.outLimit, 5);
});
