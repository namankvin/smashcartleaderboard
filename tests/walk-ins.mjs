import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
assert.ok(process.env.MONGODB_URI, "Configure MongoDB before running these tests.");
const database = `walkin_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const origin = "http://127.0.0.1:3101";
let server;
async function start() {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
    env: { ...process.env, MONGODB_DB_NAME: database }, stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Isolated test server could not start; ensure port 3101 is free.");
    try { if ((await fetch(origin)).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Test server did not become ready.");
}
async function stop() {
  if (server && server.exitCode === null) { const exited = once(server, "exit"); server.kill("SIGTERM"); await exited; }
}
async function request(path, method = "GET", body) {
  const response = await fetch(origin + path, { method, ...(body !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
const edit = (id, fields) => request(`/api/walk-ins/${id}`, "PATCH", fields);
try {
  await client.connect();
  await start();
  assert.equal((await request("/api/walk-ins", "POST", { name: "  " })).status, 400);
  const first = await request("/api/walk-ins", "POST", { name: "Walk-in Test", phone: "+91 000 000", extras: "Initial notes" });
  assert.equal(first.status, 201); assert.equal(first.queued, true);
  const id = first.profile.id;
  assert.equal(first.profile.email, "");
  const second = await request("/api/walk-ins", "POST", { name: "Walk-in Test" });
  const third = await request("/api/walk-ins", "POST", { name: "Third walk-in" });
  assert.notEqual(second.profile.id, id, "People with the same name have distinct identities");
  assert.equal((await edit(id, { name: "Before Race", email: "test@example.com" })).success, true);
  assert.equal((await edit(id, { name: " " })).status, 400);
  assert.equal((await edit(id, { phone: 123 })).status, 400);
  const queue = (await request("/api/queue")).queue;
  assert.equal(queue.find(item => item.rollNo === id).name, "Before Race");
  assert.equal(queue.find(item => item.rollNo === id).registrationSource, "walk-in");
  assert.equal((await request("/api/queue", "POST", { rollNo: id })).success, false);
  assert.equal((await request("/api/game/start-next", "POST", { queueIds: queue.map(item => item.id) })).success, true);
  // Setup actions are reversible and restore the original queue identity/order.
  const slots = (action, extra = {}) => request("/api/game/slots", "POST", { action, ...extra });
  const initialPlayer = (await request("/api/game")).players[0];
  assert.equal((await request("/api/game/finish", "POST", {})).success, false, "Preparation cannot create zero-time results");
  await client.db(database).command({ collMod: "queue", validator: { $expr: { $eq: [1, 0] } }, validationLevel: "strict" });
  assert.equal((await slots("vacate", { slot: 1, sendToQueue: true })).success, false, "Database failure does not report a completed return");
  assert.equal((await request("/api/game")).players[0].rollNo, initialPlayer.rollNo, "Failed queue write keeps the player on track");
  await client.db(database).command({ collMod: "queue", validator: {} });
  const returns = await Promise.all([slots("vacate", { slot: 1, sendToQueue: true }), slots("vacate", { slot: 1, sendToQueue: true })]);
  assert.equal(returns.filter(result => result.success).length, 1, "Repeated returns cannot duplicate a registration");
  const returnedQueue = (await request("/api/queue")).queue;
  assert.equal(returnedQueue.length, 1);
  assert.equal(returnedQueue[0].id, queue[0].id);
  assert.equal(returnedQueue[0].enqueuedAt, queue[0].enqueuedAt);
  assert.equal(returnedQueue[0].registrationSource, "walk-in");
  assert.equal((await slots("assign", { slot: 2, rollNo: initialPlayer.rollNo })).success, false, "Occupied track cannot be overwritten");
  assert.equal((await slots("move", { slot: 2, toSlot: 1 })).success, true, "Move to empty track");
  const moved = (await request("/api/game")).players;
  assert.equal(moved[1].isVacant, true);
  const beforeSwap = moved.map(player => player.rollNo);
  assert.equal((await slots("move", { slot: 1, toSlot: 3 })).success, true, "Swap occupied tracks");
  const swapped = (await request("/api/game")).players;
  assert.equal(swapped[2].rollNo, beforeSwap[0]);
  assert.equal(swapped[0].rollNo, beforeSwap[2]);
  assert.deepEqual(swapped.map(player => player.carId), ["Car 1 Red", "Car 2 Blue", "Car 3 Green"]);
  assert.equal((await slots("move", { slot: 1, toSlot: 1.5 })).success, false);
  assert.equal((await slots("return_all")).success, true);
  const restored = (await request("/api/queue")).queue;
  assert.deepEqual(restored.map(item => item.id), queue.map(item => item.id), "Original waiting order is restored");
  assert.ok((await request("/api/game")).players.every(player => player.isVacant));
  assert.equal((await request("/api/game/start-next", "POST", { queueIds: restored.map(item => item.id) })).success, true);
  await request("/api/game/timer", "POST", { action: "start_all" });
  const before = (await request("/api/game")).players.find(player => player.rollNo === id);
  assert.equal(before.isRunning, true);
  assert.equal((await slots("move", { slot: 1, toSlot: 2 })).success, false);
  assert.equal((await slots("vacate", { slot: 1, sendToQueue: true })).success, false);
  assert.equal((await slots("return_all")).success, false);

  assert.equal((await edit(id, { name: "During Race", phone: "", extras: "Updated during race", id: "forged", rollNo: "forged" })).profile.id, id);
  const during = (await request("/api/game")).players.find(player => player.rollNo === id);
  assert.equal(during.name, "During Race");
  assert.equal(during.startTime, before.startTime);
  assert.equal(during.slot, before.slot); assert.equal(during.isRunning, true);
  assert.equal(during.accumulatedMs, before.accumulatedMs);
  await request("/api/game/timer", "POST", { action: "stop_all" });
  assert.equal((await slots("return_all")).success, false, "Stopped race still locks assignments");
  const finish = await request("/api/game/finish", "POST");
  assert.equal(finish.success, true);
  const time = finish.round.players.find(player => player.rollNo === id).timeMs;
  const updated = await edit(id, { name: "After Race", email: "", extras: "Final notes" });
  assert.equal(updated.profile.email, ""); assert.equal(updated.profile.phone, "");
  const history = (await request("/api/game")).history;
  assert.equal(history[0].players.find(player => player.rollNo === id).name, "After Race");
  assert.equal(history[0].players.find(player => player.rollNo === id).timeMs, time);
  const leaderboard = await request("/api/leaderboard");
  assert.equal(leaderboard.allParticipants.find(player => player.rollNo === id).name, "After Race");
  assert.equal((await request(`/api/walk-ins?q=${encodeURIComponent("Final notes")}`)).profiles[0].id, id);
  await stop(); await start();
  assert.equal((await request(`/api/walk-ins/${id}`)).profile.name, "After Race");
  assert.equal((await request("/api/game")).history[0].players.find(player => player.rollNo === id).name, "After Race");
  assert.equal((await edit(id, { name: "After Restart" })).success, true);
  assert.equal((await request("/api/leaderboard")).allParticipants.find(player => player.rollNo === id).name, "After Restart");
  assert.equal(await client.db(database).collection("walk_ins").countDocuments(), 3);
  assert.equal((await edit("GUEST-NOT-FOUND", { name: "Missing" })).status, 404);
  // Removing an unplayed walk-in deletes their profile; recorded players are kept.
  const unplayed = await request("/api/walk-ins", "POST", { name: "Remove Without Results" });
  let waitingRemoval = (await request("/api/queue")).queue.find(item => item.rollNo === unplayed.profile.id);
  const removedUnplayed = await request(`/api/queue?id=${waitingRemoval.id}`, "DELETE");
  assert.equal(removedUnplayed.profileDeleted, true);
  assert.equal((await request(`/api/walk-ins/${unplayed.profile.id}`)).status, 404);
  assert.equal((await request("/api/walk-ins?q=Remove%20Without%20Results")).profiles.length, 0);
  assert.equal((await request(`/api/queue?id=${waitingRemoval.id}`, "DELETE")).status, 404);
  await request("/api/queue", "POST", { rollNo: id });
  waitingRemoval = (await request("/api/queue")).queue.find(item => item.rollNo === id);
  const protectedRemoval = await request(`/api/queue?id=${waitingRemoval.id}`, "DELETE");
  assert.equal(protectedRemoval.success, true);
  assert.equal(protectedRemoval.profileDeleted, false);
  assert.equal((await request(`/api/walk-ins/${id}`)).profile.name, "After Restart");
  assert.equal((await request("/api/leaderboard")).allParticipants.find(player => player.rollNo === id).bestTimeMs, time);
  const clearedGuest = await request("/api/walk-ins", "POST", { name: "Clear Unplayed" });
  await request("/api/queue", "POST", { rollNo: id });
  assert.equal((await request("/api/queue?clearAll=true", "DELETE")).success, true);
  assert.equal((await request(`/api/walk-ins/${clearedGuest.profile.id}`)).status, 404);
  assert.equal((await request(`/api/walk-ins/${id}`)).status, 200);
  assert.equal((await request("/api/queue")).queue.length, 0);
  await client.db(database).collection("students").insertOne({ rollNo: "TEST-STUDENT", name: "Keep Student" });
  await request("/api/queue", "POST", { rollNo: "TEST-STUDENT" });
  const studentQueue = (await request("/api/queue")).queue[0];
  assert.equal((await request(`/api/queue?id=${studentQueue.id}`, "DELETE")).profileDeleted, false);
  assert.equal(await client.db(database).collection("students").countDocuments({ rollNo: "TEST-STUDENT" }), 1);
  if (process.env.BROWSER_QA === "1") { const { verifyInterface } = await import("./browser-setup.mjs"); await verifyInterface(origin); }
  console.log("PASS: deletion of unplayed walk-ins, preservation of recorded guests and students, reversible assignment, original queue order/identity, track moves/swaps, failed-return safety, race locking, name-only registration, distinct walk-in IDs, shared queue, validation, before/during/after-race edits, cleared optional fields, unchanged timers/results, updated leaderboard, and MongoDB persistence after restart.");
} finally {
  await stop();
  if (database.startsWith("walkin_test_")) await client.db(database).dropDatabase();
  await client.close();
}
