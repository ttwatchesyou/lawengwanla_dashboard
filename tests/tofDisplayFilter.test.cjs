const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const target = {exports: {}};
new Function('module', 'exports', ts.transpileModule(
  fs.readFileSync(path.resolve(__dirname, '../utils/tofDisplayFilter.ts'), 'utf8'),
  {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017}}
).outputText)(target, target.exports);
const {TofDisplayFilter} = target.exports;

test('single spike is removed and channels remain independent', () => {
  const filter = new TofDisplayFilter();
  for (let i=0; i<5; i++) filter.sample([75, 10, 30, 100], 'a', i, i*200);
  assert.deepEqual(filter.sample([500, 10, 30, 100], 'a', 5, 1000), [75, 10, 30, 100]);
});
test('real distance changes settle and duplicate frames do not advance filter', () => {
  const filter = new TofDisplayFilter();
  filter.sample([50,50,50,50], 'a', 0, 0);
  for (let i=1; i<=20; i++) filter.sample([100,100,100,100], 'a', i, i*200);
  const settled = filter.sample([100,100,100,100], 'a', 21, 4200);
  assert.ok(settled.every(value => Math.abs(value-100)<0.1));
  assert.deepEqual(filter.sample([1,1,1,1], 'a', 21, 4300), settled);
});
test('stale input, new epoch and explicit reset discard previous distances', () => {
  const filter = new TofDisplayFilter();
  filter.sample([50,50,50,50], 'a', 0, 0);
  assert.deepEqual(filter.sample([100,100,100,100], 'a', 1, 1000), [100,100,100,100]);
  assert.deepEqual(filter.sample([20,20,20,20], 'b', 0, 1200), [20,20,20,20]);
  filter.reset();
  assert.deepEqual(filter.sample([80,80,80,80], 'b', 1, 1400), [80,80,80,80]);
});
