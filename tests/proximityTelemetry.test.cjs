const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name) {
  const module = {exports: {}};
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, `../utils/${name}.ts`), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017},
  }).outputText;
  new Function('module', 'exports', 'require', code)(module, module.exports, () => load('sensorTelemetry'));
  return module.exports;
}
const { proximityIndicators } = load('proximityTelemetry');
const packet = () => ({schema: 'lawengwanla.proximity.v1', board: 'uno_r4_minima', connected: true,
  sequence: 1, uptime_ms: 100, host_epoch: 'test', sample_age_ms: 0, pins: [2,3,4,5,6],
  input_mode: 'INPUT_PULLUP', active_low: true, debounce_ms: 10,
  raw: [1,1,1,1,1], levels: [0,1,0,1,0], active: [true,false,true,false,true]});
const snapshot = () => ({key: 'proximity', data: packet(), fresh: true, state: 'live',
  error: null, publisher_count: 1, age_ms: 5, stale_ms: 1000});
const unknown = Array(5).fill('unknown');
test('all five proximity indicators follow debounced active LOW, including D6', () => {
  assert.deepEqual(proximityIndicators(snapshot(), 0), ['active','inactive','active','inactive','active']);
});
test('stale, API errors, disconnect and malformed channels show unknown', () => {
  assert.deepEqual(proximityIndicators(snapshot(), 995), unknown);
  assert.deepEqual(proximityIndicators(snapshot(), 0, true), unknown);
  for (const change of [{connected:false}, {pins:[2,3,4,5]}, {pins:[6,5,4,3,2]}, {active:Array(5).fill(false)},
    {raw:[true,1,1,1,1]}, {sample_age_ms:NaN}, {sequence:1.5}, {input_mode:'INPUT'}, {schema:'lawengwanla.inductive.v1'}]) {
    const s=snapshot(); Object.assign(s.data,change);
    assert.deepEqual(proximityIndicators(s,0),unknown);
  }
  for (const change of [{publisher_count:0},{publisher_count:2},{fresh:false},{key:'r4'},{data:null}])
    assert.deepEqual(proximityIndicators({...snapshot(),...change},0),unknown);
});
