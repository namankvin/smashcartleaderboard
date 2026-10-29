import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
assert.ok(process.env.MONGODB_URI, "Configure MongoDB before running these tests.");
const database = `laps_test_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const integrationToken = "isolated-test-integration-token";
const origin = "http://127.0.0.1:3101";
let server;
async function start() {
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
    env: { ...process.env, MONGODB_DB_NAME: database, INTEGRATION_TOKEN: integrationToken }, stdio: "ignore",
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
  const response = await fetch(origin + path, { method, ...(body !== undefined ? { headers: { "Content-Type": "application/json", Authorization: `Bearer ${integrationToken}` }, body: JSON.stringify(body) } : {}) });
  return { status: response.status, ...await response.json() };
}
const edit = (id, fields) => request(`/api/walk-ins/${id}`, "PATCH", fields);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let bridge;
let tracker;
try {
  await client.connect(); await start();
  assert.equal((await request("/api/students", "POST", { rollNo: "SCAN001", name: "RFID Student", email: "scan@example.com" })).success, true);
  assert.equal((await request("/api/rfid/cards", "POST", { uid: "TEST-CARD", rollNo: "UNKNOWN" })).success, false);
  assert.equal((await request("/api/rfid/cards", "POST", { uid: "TEST-CARD", rollNo: "SCAN001" })).success, true);
  assert.equal((await request("/api/webhook/rfid", "POST", { uid: "UNPAIRED" })).status, 422);
  const scan = await request("/api/webhook/rfid", "POST", { uid: "test-card" });
  assert.equal(scan.success, true); assert.equal(scan.item.name, "RFID Student");
  assert.equal((await request("/api/webhook/rfid", "POST", { uid: "test-card" })).success, false);
  assert.equal((await fetch(origin + "/api/webhook/rfid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uid: "test-card" }) })).status, 401);
  await request(`/api/queue?id=${scan.item.id}`, "DELETE");
  const guests = [];
  for (const name of ["Lap Racer A", "Lap Racer B", "Lap Racer C"]) guests.push((await request("/api/walk-ins", "POST", { name, email: "lap@example.com", phone: "12345", extras: "Test profile" })).profile);
  const queue = (await request("/api/queue")).queue;
  assert.equal((await request("/api/game/settings", "POST", { targetLaps: 0 })).success, false);
  assert.equal((await request("/api/game/settings", "POST", { targetLaps: 2 })).success, true);
  await request("/api/game/start-next", "POST", { queueIds: queue.map(item => item.id) });
  await request("/api/game/timer", "POST", { action: "start_all" });
  let game = await request("/api/game"); const raceId = game.raceId;
  const lap = (slot, lapNumber, eventId) => request("/api/game/lap", "POST", { raceId, slot, lapNumber, eventId });
  const telemetry = (car, number, extra = {}) => request("/api/telemetry", "POST", { raceId, car, lap: number, eventId: `${car}-${number}`, status: "VISIBLE", in_tunnel: false, timestamp: Date.now() / 1000, ...extra });
  assert.equal((await request("/api/game/settings", "POST", { targetLaps: 3 })).success, false);
  assert.equal((await lap(1, 2, "gap")).success, false);
  assert.equal((await request("/api/game/lap", "POST", { raceId: "stale", slot: 1, lapNumber: 1, eventId: "old" })).success, false);
  const duplicated = await Promise.all([lap(1, 1, "manual-one"), lap(1, 1, "manual-one")]);
  assert.equal(duplicated.filter(result => !result.duplicate && result.success).length, 1);
  assert.equal(await client.db(database).collection("lap_records").countDocuments({ raceId, slot: 1 }), 1);
  assert.equal((await telemetry("Car 2 Blue", 1, { in_tunnel: true })).success, false);
  assert.equal((await telemetry("Car 2 Blue", 1)).success, true);
  await request("/api/game/timer", "POST", { action: "stop", slot: 1 });
  assert.equal((await lap(1, 2, "paused")).success, false);
  await request("/api/game/timer", "POST", { action: "start", slot: 1 });
  const finishedA = await lap(1, 2, "manual-two");
  assert.equal(finishedA.success, true);
  const playerA = finishedA.players.find(player => player.slot === 1);
  assert.equal(playerA.status, "finished"); assert.equal(playerA.isRunning, false);
  assert.equal(playerA.accumulatedMs, playerA.laps.reduce((sum, item) => sum + item.lapTimeMs, 0));
  assert.equal((await lap(1, 3, "too-many")).success, false);
  await request("/api/game/timer", "POST", { action: "start", slot: 1 });
  assert.equal((await request("/api/game")).players[0].isRunning, false, "Finished racers cannot restart");
  assert.equal((await telemetry("Car 2 Blue", 2)).success, true);
  await client.db(database).command({ collMod: "lap_records", validator: { $expr: { $eq: [1, 0] } }, validationLevel: "strict" });
  assert.equal((await lap(3, 1, "failed-write")).success, false);
  assert.equal((await request("/api/game")).players[2].laps?.length || 0, 0, "Failed lap save cannot increment the counter");
  await client.db(database).command({ collMod: "lap_records", validator: {} });
  assert.equal((await lap(3, 1, "third-one")).success, true);
  assert.equal((await request("/api/game/timer", "POST", { action: "reset_all" })).success, false, "Saved laps cannot be erased");
  await stop(); await start();
  game = await request("/api/game");
  assert.equal(game.raceId, raceId); assert.equal(game.targetLaps, 2);
  assert.equal(game.players[0].status, "finished"); assert.equal(game.players[0].accumulatedMs, playerA.accumulatedMs);
  assert.equal(game.players[2].laps.length, 1); assert.equal(game.players[2].isRunning, true);
  assert.equal((await lap(3, 2, "third-two")).success, true);
  game = await request("/api/game"); assert.ok(game.players.every(player => player.status === "finished" && !player.isRunning));
  assert.equal(await client.db(database).collection("lap_records").countDocuments({ raceId }), 6);
  const results = await client.db(database).collection("race_results").find({ raceId }).toArray();
  assert.equal(results.length, 3);
  for (const result of results) { assert.equal(result.laps.length, 2); assert.equal(result.participant.email, "lap@example.com"); assert.equal(result.participant.phone, "12345"); assert.equal(result.status, "finished"); }
  const finish = await request("/api/game/finish", "POST", {}); assert.equal(finish.success, true);
  assert.ok(finish.round.players.every(player => player.laps.length === 2));
  assert.equal((await lap(1, 1, "late-old-race")).success, false);
  assert.equal((await request("/api/leaderboard")).topThree.length, 3);

  // Exercise the actual WebSocket-to-website bridge with synthetic tracker frames.
  for (const profile of guests) await request("/api/queue", "POST", { rollNo: profile.id });
  const nextQueue = (await request("/api/queue")).queue;
  await request("/api/game/start-next", "POST", { queueIds: nextQueue.map(item => item.id) });
  await request("/api/game/settings", "POST", { targetLaps: 1 });
  bridge = spawn(process.execPath, ["scripts/tracker-bridge.mjs", "--origin", origin, "--port", "8189"], { env: { ...process.env, INTEGRATION_TOKEN: integrationToken }, stdio: "ignore" });
  for (let attempt = 0; attempt < 100; attempt++) { try { await fetch("http://127.0.0.1:8189"); break; } catch { await pause(100); } }
  tracker = new WebSocket("ws://127.0.0.1:8189");
  await new Promise((resolve, reject) => { tracker.addEventListener("open", resolve, { once: true }); tracker.addEventListener("error", reject, { once: true }); });
  for (const car of ["Car 1 Red", "Car 2 Blue", "Car 3 Green"]) tracker.send(JSON.stringify({ car, lap: 10, timestamp: Date.now() / 1000, status: "VISIBLE", in_tunnel: false }));
  await pause(500); await request("/api/game/timer", "POST", { action: "start_all" }); await pause(400);
  for (const car of ["Car 1 Red", "Car 2 Blue", "Car 3 Green"]) tracker.send(JSON.stringify({ car, lap: 11, timestamp: Date.now() / 1000, status: "VISIBLE", in_tunnel: false }));
  for (let attempt = 0; attempt < 60; attempt++) { game = await request("/api/game"); if (game.players.every(player => player.status === "finished")) break; await pause(150); }
  assert.ok(game.players.every(player => player.laps.length === 1 && player.status === "finished"), "Tracker bridge stops all three players at the configured lap target");
  console.log("PASS: RFID UID pairing/scans, per-player manual/tracker laps, automatic finish, idempotency, invalid event rejection, transactional lap saving, restart recovery, participant snapshots, all-player results, and live WebSocket bridge.");
} finally {
  tracker?.close();
  if (bridge && bridge.exitCode === null) { const exited = once(bridge, "exit"); bridge.kill("SIGTERM"); await exited; }
  await stop();
  if (database.startsWith("laps_test_")) await client.db(database).dropDatabase();
  await client.close();
}
