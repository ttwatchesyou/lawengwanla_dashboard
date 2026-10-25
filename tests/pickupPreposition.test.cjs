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
const { selectPickupCell, pickupTargets, pickupMatches, parsePickSetup } = load("pickupPreposition");
test("one pickup per floor; replacing preserves order, clicking again removes", () => {
  const original = { color: "blue", plate: 1, picks: [{ row:2,col:0 }, { row:0,col:1 }] };
  const changed = selectPickupCell(original, {row:2,col:2});
  assert.deepEqual(changed.picks, [{row:2,col:2},{row:0,col:1}]);
  assert.deepEqual(original.picks, [{row:2,col:0},{row:0,col:1}]);
  assert.deepEqual(selectPickupCell(changed,{row:2,col:2}).picks,[{row:0,col:1}]);
  assert.deepEqual(pickupTargets(changed.picks),{floor3:3,floor1:2});
});
test("ready confirmation must match the exact selected floors and columns", () => {
  const setup = { locked:false,ready:true,revision:3,targets:{floor1:1,floor3:2} };
  assert.ok(parsePickSetup(setup));
  assert.ok(pickupMatches(setup,[{row:2,col:1},{row:0,col:0}]));
  assert.equal(pickupMatches(setup,[{row:2,col:2},{row:0,col:0}]),false);
  assert.equal(pickupMatches(setup,[]),false);
  assert.equal(parsePickSetup({...setup,targets:{floor4:1}}),null);
  assert.equal(parsePickSetup({...setup,targets:{floor1:true}}),null);
});
