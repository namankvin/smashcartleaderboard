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
    if (value && typeof value === "object" && "$regex" in value) return value.$regex.test(doc[key]);
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
// Leaderboard uses each completed lap immediately, even before race archival.
let standings = await worker().api.getLeaderboardData();
assert.equal(standings.totalParticipantsCount, 1);
assert.equal(standings.topThree[0].rollNo, guest.profile.id);
const lap = (lapNumber, lapTimeMs) => ({ lapNumber, lapTimeMs, elapsedMs: lapTimeMs, completedAt: "2026-10-30T00:00:00.000Z", source: "manual", eventId: `lap-${lapNumber}` });
shared.set("lap_records", [
  { raceId: "unfinished", rollNo: "A", participant: { name: "Unfinished racer" }, ...lap(1, 4291) },
  { raceId: "unfinished", rollNo: "A", participant: { name: "Unfinished racer" }, ...lap(2, 5000) },
  { raceId: "finished", rollNo: "B", participant: { name: "Finished racer" }, ...lap(1, 5841) },
  { raceId: "second-attempt", rollNo: "A", participant: { name: "Unfinished racer" }, ...lap(1, 3900) },
  { raceId: "invalid", rollNo: "BAD", participant: { name: "Invalid lap" }, ...lap(1, 0) },
]);
shared.set("rounds", [
  { id: "archived", raceId: "unfinished", players: [{ rollNo: "A", name: "Unfinished racer", status: "dnf", timeMs: 999999, laps: [lap(1, 4291), lap(2, 5000)] }] },
  { id: "old-round", players: [{ rollNo: "C", name: "Older racer", status: "dnf", laps: [lap(1, 7453)] }, { rollNo: "NO-LAP", name: "No completed lap", status: "finished", timeMs: 1000 }] },
]);
standings = await worker().api.getLeaderboardData();
assert.equal(standings.totalParticipantsCount, 3, "Only players with a valid completed lap are ranked");
assert.equal(standings.allParticipants.map(p => p.rollNo).join(","), "A,B,C", "DNF single lap outranks slower finished racer");
assert.equal(standings.topThree.length, 3, "Unfinished racers qualify for the podium");
assert.equal(standings.allParticipants[0].bestTimeMs, 3900);
assert.equal(standings.allParticipants[0].bestTimeFormatted, "00:03.900");
assert.equal(standings.allParticipants[0].lapsCompleted, 3, "Archived copies do not double-count laps");
assert.equal(standings.allParticipants[0].roundsPlayed, 2);
assert.equal(standings.allParticipants[2].bestTimeMs, 7453, "Older archived laps are included");
const searched = await worker().api.getLeaderboardData("Older");
assert.equal(searched.allParticipants[0].rank, 3, "Search preserves overall rank");
assert.equal(searched.topThree.length, 3, "Search preserves the overall podium");
// Unknown roll values are names, with a stable durable guest identity.
shared.set("queue", []);
shared.set("arena_state", [{ _id: "current", state: { activePlayers: [], roundNumber: 1, raceStarted: false, raceId: "guest-test", targetLaps: 3, withdrawn: [] } }]);
shared.set("students", [{ rollNo: "KNOWN001", name: "Known student" }]);
const endpointWorker = worker();
const registered = await endpointWorker.api.registerEndpointValue("  Rahul Sharma  ");
assert.equal(registered.success, true);
assert.equal(registered.item.name, "Rahul Sharma");
assert.equal(registered.item.registrationSource, "walk-in");
const guestId = registered.item.rollNo;
assert.ok(guestId.startsWith("GUEST-"));
const profileCount = shared.get("walk_ins").length;
const retried = await worker().api.registerEndpointValue("RAHUL   SHARMA");
assert.equal(retried.success, false);
assert.equal(shared.get("walk_ins").length, profileCount);
assert.equal(shared.get("queue").length, 1);
const simultaneous = await Promise.all([endpointWorker.api.registerEndpointValue("New Visitor"), endpointWorker.api.registerEndpointValue("new visitor")]);
assert.equal(simultaneous.filter(r => r.success).length, 1, "Concurrent retries create one queue entry");
await worker().api.updateWalkIn(guestId, { name: "Rahul Updated", email: "rahul@example.test", phone: "12345" });
assert.equal((await worker().api.registerEndpointValue("Rahul Sharma")).success, false);
assert.equal((await worker().api.getWalkInProfile(guestId)).name, "Rahul Updated", "Retries preserve admin edits");
assert.equal((await worker().api.assignPlayerToArenaSlot(1, guestId)).success, true);
assert.equal((await worker().api.registerEndpointValue("rahul sharma")).success, false, "An active guest is not requeued");
assert.equal(shared.get("walk_ins").filter(p => p.id === guestId).length, 1);
shared.get("arena_state")[0].state.activePlayers = [];
const laterAttempt = await worker().api.registerEndpointValue("Rahul Sharma");
assert.equal(laterAttempt.success, true, "The same guest can enter a later race");
assert.equal(laterAttempt.item.rollNo, guestId);
assert.equal(laterAttempt.item.name, "Rahul Updated");
assert.equal((await worker().api.getWalkInProfile(guestId)).email, "rahul@example.test");
assert.equal(shared.get("walk_ins").filter(p => p.id === guestId).length, 1);
const known = await worker().api.registerEndpointValue("known001");
assert.equal(known.success, true);
assert.equal(known.item.name, "Known student");
assert.equal(known.item.registrationSource, "rfid");
assert.equal(shared.get("students").length, 1, "Guest names never create student rows");
const missing = worker({ configured: false });
await assert.rejects(missing.api.getQueue(), /MONGODB_URI/);
const reconnect = worker({ failFirst: true });
await assert.rejects(reconnect.api.getQueue(), /MongoDB is unavailable/);
await reconnect.api.getQueue();
assert.equal(reconnect.attempts(), 2, "Failed connection promises are retried by the next request");
console.log("PASS: independent cold-worker queue/track/lap recovery, no contacts-file dependency, hosted missing-config rejection, bounded connection pooling, retry, and best-single-lap standings including unfinished/live races, historical fallback, deduplication and search (simulated MongoDB).");
