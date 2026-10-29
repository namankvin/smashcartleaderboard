import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Run against an empty local session. The test only removes its own registrations.
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const contacts = JSON.parse(readFileSync(process.env.CONTACTS_FILE || "data/contacts.json", "utf8")).slice(0, 5);
const rolls = contacts.map(contact => contact.rollNumber.toUpperCase());
async function request(path, body, method = "POST") {
  const res = await fetch(`${origin}${path}`, body === undefined && method === "GET" ? undefined : {
    method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, ...await res.json() };
}
const queue = () => request("/api/queue", undefined, "GET");
const arena = () => request("/api/game", undefined, "GET");
const seat = (slot, rollNo) => request("/api/game/slots", { action: "assign", slot, rollNo });
const dispatch = queueIds => request("/api/game/start-next", { queueIds });
assert.equal((await queue()).queue.length, 0, "Use an empty test queue");
assert.ok((await arena()).players.every(player => player.isVacant), "Use an empty test track");
try {
  const lookup = await request(`/api/students/${rolls[0].toLowerCase()}`, undefined, "GET");
  assert.equal(lookup.student.name, contacts[0].name);
  assert.equal(lookup.student.email, contacts[0].mail);
  assert.equal((await request("/api/queue", { rollNo: "UNKNOWN-ROLL" })).success, false);
  assert.equal((await request("/api/queue", { rollNo: 123 })).status, 400);
  assert.equal((await request("/api/webhook/rfid", { uid: "UNRESOLVED-CARD" })).status, 422);
  const scans = await Promise.all([
    request("/api/queue", { rollNo: ` ${rolls[0].toLowerCase()} ` }),
    request("/api/webhook/rfid", { rollNo: rolls[0] }),
    request("/api/webhook/rfid", { rollNo: rolls[0] }),
  ]);
  assert.equal(scans.filter(result => result.success).length, 1, "Concurrent manual/scans create one registration");
  assert.equal((await queue()).queue.length, 1);
  assert.equal((await request("/api/webhook/rfid", { rollNumber: rolls[1] })).item.registrationSource, "rfid");
  for (const rollNo of rolls.slice(2)) assert.equal((await request("/api/queue", { rollNo })).success, true);
  const waiting = (await queue()).queue;
  const chosen = [waiting[3], waiting[1], waiting[4]];
  assert.equal((await dispatch([])).success, false);
  assert.equal((await dispatch(chosen.slice(0, 2).map(item => item.id))).success, false);
  assert.equal((await dispatch([chosen[0].id, chosen[0].id, chosen[1].id])).success, false);
  assert.equal((await dispatch([chosen[0].id, chosen[1].id, "stale-id"])).success, false);
  assert.equal((await seat(1.5, rolls[0])).success, false);
  assert.equal((await seat(1, "UNKNOWN-ROLL")).success, false);
  const results = await Promise.all([dispatch(chosen.map(item => item.id)), dispatch(chosen.map(item => item.id))]);
  assert.equal(results.filter(result => result.success).length, 1, "Concurrent dispatch cannot overwrite a roster");
  const players = (await arena()).players;
  assert.deepEqual(players.map(player => player.rollNo), chosen.map(item => item.rollNo), "Admin chooses any players in car order");
  assert.deepEqual(players.map(player => player.carId), ["Car 1 Red", "Car 2 Blue", "Car 3 Green"]);
  assert.ok(players.every(player => !player.isRunning), "Assignment does not start the race");
  assert.equal((await queue()).queue.length, 2);
  assert.equal((await seat(1, rolls[0])).success, false, "Occupied car cannot be overwritten");
  assert.equal((await request("/api/queue", { rollNo: players[0].rollNo })).success, false, "Active player cannot queue again");
  const returned = await request("/api/game/slots", { action: "vacate", slot: 1, sendToQueue: true });
  assert.equal(returned.success, true);
  assert.ok((await queue()).queue.some(item => item.rollNo === players[0].rollNo), "Vacated player returns to queue");
  assert.equal((await seat(1, players[0].rollNo)).success, true);
  console.log("PASS: contact lookup, unknown rolls, RFID handoff, concurrent deduplication, explicit three-player selection, car mapping, occupied-slot protection, and return to queue.");
} finally {
  for (const player of (await arena()).players) {
    if (!player.isVacant && rolls.includes(player.rollNo)) await request("/api/game/slots", { action: "vacate", slot: player.slot });
  }
  for (const item of (await queue()).queue) {
    if (rolls.includes(item.rollNo)) await request(`/api/queue?id=${encodeURIComponent(item.id)}`, undefined, "DELETE");
  }
}
