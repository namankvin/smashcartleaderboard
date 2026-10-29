import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { WebSocketServer } = require("next/dist/compiled/ws");
const argument = (name, fallback) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : fallback; };
const origin = argument("--origin", "http://127.0.0.1:3000");
const port = Number(argument("--port", "8081"));
const token = process.env.INTEGRATION_TOKEN;
const cars = ["Car 1 Red", "Car 2 Blue", "Car 3 Green"];
const frames = new Map(cars.map(car => [car, []]));
const progress = new Map();
let raceId = "";
let busy = false;
const server = new WebSocketServer({ host: "127.0.0.1", port });
server.on("connection", socket => socket.on("message", data => {
  try {
    const payload = JSON.parse(data.toString());
    for (const frame of Array.isArray(payload) ? payload : [payload]) {
      if (!cars.includes(frame.car) || !Number.isInteger(frame.lap) || frame.lap < 0 || !Number.isFinite(frame.timestamp)) continue;
      const buffer = frames.get(frame.car);
      if (buffer.length && frame.timestamp <= buffer.at(-1).timestamp) continue;
      buffer.push(frame); if (buffer.length > 150) buffer.shift();
    }
  } catch { console.error("Ignored an invalid tracker message."); }
}));
const interval = setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    const game = await (await fetch(`${origin}/api/game`, { signal: AbortSignal.timeout(4000) })).json();
    if (!game.success) throw new Error("Race state unavailable.");
    if (raceId !== game.raceId) { raceId = game.raceId; progress.clear(); }
    if (!game.raceStarted || !game.startedAt) return;
    for (const player of game.players.filter(player => !player.isVacant)) {
      const buffer = frames.get(player.carId);
      if (!buffer) continue;
      if (!progress.has(player.carId)) {
        const beforeStart = buffer.filter(frame => Math.round(frame.timestamp * 1000) <= game.startedAt).at(-1);
        if (!beforeStart) { if (buffer.length) { progress.set(player.carId, { blocked: true }); console.error(`${player.carId}: no pre-start tracker baseline. Use manual lap controls for this round.`); } continue; }
        progress.set(player.carId, { baseline: beforeStart.lap, counter: beforeStart.lap, timestamp: beforeStart.timestamp, blocked: false });
      }
      const state = progress.get(player.carId);
      if (state.blocked || !player.isRunning) continue;
      for (const frame of buffer.filter(frame => frame.timestamp > state.timestamp)) {
        state.timestamp = frame.timestamp;
        if (frame.lap <= state.counter) continue;
        const lap = frame.lap - state.baseline;
        if (frame.lap !== state.counter + 1 || !["VISIBLE", "EXITING_TUNNEL"].includes(frame.status) || frame.in_tunnel) {
          state.blocked = true; console.error(`${player.carId}: skipped or unobserved crossing. Manual review required.`); break;
        }
        if (lap > game.targetLaps) break;
        const response = await fetch(`${origin}/api/telemetry`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ ...frame, raceId, lap, eventId: `${raceId}:${player.carId}:${lap}` }), signal: AbortSignal.timeout(4000) });
        const result = await response.json();
        if (!result.success) { state.blocked = true; console.error(`${player.carId}: crossing was not saved. ${result.message || "Review the race controls."}`); break; }
        state.counter = frame.lap;
        console.log(`${player.carId}: lap ${lap}/${game.targetLaps} saved.`);
      }
    }
  } catch { console.error("Website connection unavailable; buffered tracker frames retained for retry."); }
  finally { busy = false; }
}, 300);
server.on("listening", () => console.log(`Tracker bridge ready: ws://127.0.0.1:${port} → ${origin}. Start this before the race; physical crossing accuracy still requires track calibration.`));
function stop() { clearInterval(interval); for (const socket of server.clients) socket.terminate(); server.close(() => process.exit(0)); }
process.on("SIGTERM", stop); process.on("SIGINT", stop);
