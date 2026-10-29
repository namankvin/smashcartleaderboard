import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const { NextRequest } = require("next/server");
const key = "contract-test-key";
process.env.RFID_API_KEY = key;
process.env.INTEGRATION_TOKEN = "contract-test-token";
let queue = [], offline = false;
const student = { rollNo: "SCAN001", name: "Contract Test Student" };
const db = {
  resolveRFIDCard: async uid => { if (offline) throw new Error("Unavailable"); return uid.trim().toUpperCase() === "CARD001" ? student.rollNo : null; },
  findStudentByRollNo: async roll => roll.trim().toUpperCase() === student.rollNo ? student : null,
  getQueue: async () => queue,
  addToQueueByRollNo: async (roll, _name, source) => {
    if (offline) throw new Error("Unavailable");
    if (roll.trim().toUpperCase() !== student.rollNo) return { success: false, message: "Unknown student." };
    if (queue.length) return { success: false, item: queue[0], message: "Already waiting." };
    const item = { ...student, id: "test-registration", registrationSource: source }; queue.push(item);
    return { success: true, item, message: "Registered." };
  },
};
function compile(file, dependencies) {
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] || require(name), Buffer, process }, { filename: file });
  return module.exports;
}
const shared = compile("lib/rfidScan.ts", { "./db": db });
const primary = compile("app/api/arcade/scan/route.ts", { "@/lib/rfidScan": shared });
const fallback = compile("app/api/rfid/scan/route.ts", { "@/lib/rfidScan": shared });
function req(payload, suppliedKey = key, extra = {}) {
  return new NextRequest("http://test.local/api/arcade/scan", { method: "POST", headers: { "Content-Type": "application/json", ...(suppliedKey ? { "x-api-key": suppliedKey } : {}), ...extra }, body: JSON.stringify(payload) });
}
for (const route of [primary, fallback]) {
  assert.equal((await route.POST(req({ rollNumber: "SCAN001" }, ""))).status, 401);
  assert.equal((await route.POST(req({ rollNumber: "SCAN001" }, "wrong"))).status, 401);
  assert.equal((await route.POST(req({ rollNumber: "SCAN001" }, "", { authorization: "Bearer contract-test-token" }))).status, 401);
  for (const payload of [null, [], {}, { rollNumber: 42 }, { rollNo: " " }]) assert.equal((await route.POST(req(payload))).status, 400);
  assert.equal((await route.POST(new NextRequest("http://test.local", { method: "POST", headers: { "x-api-key": key }, body: "{" }))).status, 400);
  assert.equal((await route.POST(req({ uid: "UNPAIRED" }))).status, 422);
  assert.equal((await route.OPTIONS()).status, 204);
  assert.ok((await route.OPTIONS()).headers.get("access-control-allow-headers").includes("x-api-key"));
  assert.ok(!JSON.stringify(await (await route.GET()).json()).includes(key));
  for (const payload of [{ rollNumber: " scan001 " }, { rollNo: "SCAN001" }, { rfid: "SCAN001" }, { rfid: "card001" }, { uid: "CARD001" }]) {
    queue = [];
    const response = await route.POST(req(payload)); assert.equal(response.status, 201);
    const result = await response.json(); assert.equal(result.student.name, student.name); assert.equal(result.queuePosition, 1); assert.equal(result.item.registrationSource, "rfid");
    assert.equal((await fallback.POST(req({ rollNumber: "SCAN001" }))).status, 409); assert.equal(queue.length, 1);
  }
}
queue = [];
assert.equal((await shared.handleRFIDScan(req({ rollNo: "SCAN001" }, "", { authorization: "Bearer contract-test-token" }), false)).status, 201);
offline = true; queue = [];
assert.equal((await primary.POST(req({ rollNumber: "SCAN001" }))).status, 503);
assert.equal((await primary.POST(req({ uid: "CARD001" }))).status, 503);
delete process.env.RFID_API_KEY;
assert.equal((await primary.POST(req({ rollNo: "SCAN001" }))).status, 503);
console.log("PASS: actual primary/fallback handlers, x-api-key validation, all payload aliases, shared queue deduplication, malformed input, CORS, legacy Bearer compatibility, unavailable database and missing key.");
