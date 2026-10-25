const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
const source = ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/serviceApi.ts`, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function client(fetch, timers = {}) {
  const module = { exports: {} };
  new Function("module", "exports", "process", "fetch", "AbortController", "setTimeout", "clearTimeout", source)(
    module, module.exports, { env: {} }, fetch, AbortController,
    timers.setTimeout || setTimeout, timers.clearTimeout || clearTimeout
  );
  return module.exports.serviceRequest;
}
test("service requests use same-origin API when no environment URL exists", async () => {
  const request = client(async (url, options) => {
    assert.equal(url, "/api/services");
    assert.equal(options.cache, "no-store");
    return { ok: true, json: async () => ({ services: [] }) };
  });
  assert.deepEqual(await request("/services"), { services: [] });
});
test("service action failures propagate backend detail without retrying", async () => {
  let calls = 0;
  const request = client(async () => {
    calls++;
    return { ok: false, json: async () => ({ detail: "Wheel UART is busy" }) };
  });
  await assert.rejects(request("/control", { method: "POST" }), /Wheel UART is busy/);
  assert.equal(calls, 1);
});
test("an unresponsive service request aborts and reports a timeout", async () => {
  let fire, cleared = false;
  const request = client((url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")));
  }), {
    setTimeout: (fn, ms) => { assert.equal(ms, 10000); fire = fn; return 1; },
    clearTimeout: () => { cleared = true; },
  });
  const pending = request("/services");
  fire();
  await assert.rejects(pending, /10 วินาที/);
  assert.equal(cleared, true);
});
