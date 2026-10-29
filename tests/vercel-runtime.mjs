import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { AsyncLocalStorage } from "node:async_hooks";
import vm from "node:vm";
const require = createRequire(import.meta.url), ts = require("typescript");
const shared = new Map();
let sequence = 0, contactReads = 0;
const clone = value => value === undefined ? undefined : structuredClone(value);
function matches(doc, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or") return value.some(item => matches(doc, item));
    if (value && typeof value === "object" && "$in" in value) return value.$in.includes(doc[key]);
    return doc[key] === value;
  });
}
function collection(name) {
  if (!shared.has(name)) shared.set(name, []);
  const rows = () => shared.get(name);
  return {
    createIndex: async () => "index-ready",
    countDocuments: async filter => rows().filter(row => matches(row, filter)).length,
    findOne: async filter => clone(rows().find(row => matches(row, filter)) || null),
    find(filter = {}) { let limit = Infinity; return { sort() { return this; }, limit(value) { limit = value; return this; }, async toArray() { return clone(rows().filter(row => matches(row, filter)).slice(0, limit)); } }; },
    async insertOne(doc) { rows().push(clone({ _id: `row-${++sequence}`, ...doc })); return { insertedId: `row-${sequence}` }; },
    async updateOne(filter, update, options = {}) { let row = rows().find(row => matches(row, filter)); if (!row && options.upsert) { row = clone({ ...filter, ...update.$setOnInsert }); rows().push(row); } if (row) Object.assign(row, clone(update.$set)); return { modifiedCount: row ? 1 : 0 }; },
    async replaceOne(filter, replacement) { const index = rows().findIndex(row => matches(row, filter)); const row = clone({ ...filter, ...replacement }); if (index >= 0) rows()[index] = row; else rows().push(row); return { modifiedCount: 1 }; },
    async deleteOne(filter) { const index = rows().findIndex(row => matches(row, filter)); if (index >= 0) rows().splice(index, 1); return { deletedCount: index >= 0 ? 1 : 0 }; },
  };
}
function worker({ configured = true, failFirst = false } = {}) {
  let attempts = 0;
  class Client {
    constructor(_uri, options) { assert.equal(options.maxPoolSize, 10); assert.equal(options.serverSelectionTimeoutMS, 8000); }
    async connect() { attempts++; if (failFirst && attempts === 1) throw new Error("Temporary failure"); return this; }
    db() { return { collection }; }
    async close() {}
    async withSession(fn) { return fn({ withTransaction: async callback => callback() }); }
  }
  const storage = new AsyncLocalStorage();
  const dependencies = {
    mongodb: { MongoClient: Client },
    "./mongoSession": { arenaTransaction: storage, databaseInTransaction: db => db },
    "./contacts": { getContacts() { contactReads++; throw new Error("A hosted worker must never read a local contacts file"); } },
    "./cars": { TRACK_CARS: ["Car 1 Red", "Car 2 Blue", "Car 3 Green"] },
    "./types": {},
  };
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync("lib/db.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: name => dependencies[name] || require(name), process: { env: { VERCEL: "1", ...(configured ? { MONGODB_URI: "mongodb://runtime-test.invalid", MONGODB_DB_NAME: "runtime-test" } : {}) } }, structuredClone, console }, { filename: "serverless-db.ts" });
  return { api: module.exports, attempts: () => attempts };
}
const first = worker();
const guest = await first.api.createWalkIn({ name: "Serverless Visitor" });
assert.equal(guest.queued, true);
const second = worker();
assert.equal((await second.api.getQueue()).length, 1, "A separate cold worker sees the shared queue");
assert.equal((await second.api.assignPlayerToArenaSlot(1, guest.profile.id)).success, true);
const third = worker();
let arena = await third.api.getActiveArena();
assert.equal(arena.players[0].rollNo, guest.profile.id, "Track assignments are restored in another worker");
await third.api.configureRace(1);
await third.api.updateArenaAll("start_all");
await new Promise(resolve => setTimeout(resolve, 15));
const fourth = worker();
arena = await fourth.api.getActiveArena();
assert.equal(arena.raceStarted, true);
assert.equal(arena.targetLaps, 1);
await fourth.api.recordPlayerLap({ raceId: arena.raceId, slot: 1, lapNumber: 1, eventId: "serverless-lap" });
const fifth = worker();
assert.equal((await fifth.api.getActiveArena()).players[0].status, "finished");
assert.equal(shared.get("lap_records").length, 1);
assert.equal(contactReads, 0, "No worker requires the ignored contacts.json file");
const missing = worker({ configured: false });
await assert.rejects(missing.api.getQueue(), /MONGODB_URI/);
const reconnect = worker({ failFirst: true });
await assert.rejects(reconnect.api.getQueue(), /MongoDB is unavailable/);
await reconnect.api.getQueue();
assert.equal(reconnect.attempts(), 2, "Failed connection promises are retried by the next request");
console.log("PASS: independent cold-worker queue/track/lap recovery, no contacts-file dependency, hosted missing-config rejection, bounded connection pooling and retry after a failed connection (simulated MongoDB).");
