import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url), ts = require("typescript");
function compile(file, dependencies, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] || require(name), console, ...globals }, { filename: file });
  return module.exports;
}
let time = Date.now(), fetches = 0, imports = 0, offline = false, dbUnavailable = false;
const env = { VERCEL: "1" };
const rows = [
  { id: "newer", rollNumber: " Visitor Name ", name: " Visitor Name ", mail: "v@example.test", registeredAt: "2026-10-31T07:00:00Z" },
  { id: "older", rollNumber: "24CSB0B68", name: "Shashank", registeredAt: "2026-10-31T06:00:00Z" },
  { id: "older", rollNumber: "24CSB0B68", name: "Shashank", registeredAt: "2026-10-31T06:00:00Z" },
  { id: "invalid-date", rollNumber: "X", registeredAt: "bad-date" },
  { id: "blank-name", rollNumber: " ", registeredAt: "2026-10-31T06:00:00Z" },
];
const sync = compile("lib/rcRegistrationSync.ts", { "./db": { reconcileRCRegistrations: async entries => {
  imports++; assert.equal(entries.length, 2); return { added: 1, handled: 2, pending: 0 };
} } }, {
  process: { env }, Date: class extends Date { static now() { return time; } }, AbortSignal,
  fetch: async (url, options) => {
    fetches++; assert.equal(url, "https://rc-tz-26.vercel.app/api/waiting-list"); assert.equal(options.cache, "no-store");
    assert.ok(options.signal); if (offline) throw new Error("Temporary source outage");
    return { ok: true, json: async () => ({ success: true, list: rows }) };
  },
});
assert.equal(sync.parseRCRegistrations({ success: true, list: rows }).map(e => e.id).join(","), "older,newer");
assert.equal(sync.parseRCRegistrations({ success: true, list: rows })[1].rollNumber, "Visitor Name");
assert.throws(() => sync.parseRCRegistrations({ success: false, list: [] }));
const results = await Promise.all([sync.syncRCRegistrations(), sync.syncRCRegistrations()]);
assert.equal(results[0].success, true);
assert.equal(fetches, 1, "Concurrent queue polls share one source request");
assert.equal(imports, 1);
await sync.syncRCRegistrations();
assert.equal(fetches, 1, "Frequent queue polls are throttled");
time += 6000; offline = true;
assert.equal((await sync.syncRCRegistrations()).success, false);
assert.equal(imports, 1, "An unavailable source never marks entries as processed");
time += 6000; offline = false;
assert.equal((await sync.syncRCRegistrations()).success, true);
assert.equal(imports, 2, "A later poll retries after a source failure");
env.RC_REGISTRATION_SYNC = "false";
assert.equal((await sync.syncRCRegistrations()).enabled, false);
const fetchesBefore = fetches;
const queueRoute = compile("app/api/queue/route.ts", {
  "@/lib/db": { getQueue: async () => { if (dbUnavailable) throw new Error("Database unavailable"); return [{ id: "existing-player", name: "Existing player" }]; } },

});
const reply = await queueRoute.GET();
assert.equal(reply.status, 200);
const data = await reply.json();
assert.equal(data.queue[0].name, "Existing player", "RC outages do not hide the local queue");
const syncRoute = compile("app/api/registrations/sync/route.ts", {
  "@/lib/rcRegistrationSync": { syncRCRegistrations: async () => ({ enabled: true, success: false, message: "Source unavailable" }) },
});
assert.equal((await syncRoute.POST()).status, 503, "RC failures are isolated to the recovery endpoint");
dbUnavailable = true;
assert.equal((await queueRoute.GET()).status, 500);
assert.equal(fetches, fetchesBefore);
console.log("PASS: RC response validation, chronological import, event deduplication, concurrent poll coalescing, throttling, retry after outage, disable switch, and queue availability during RC outages.");
