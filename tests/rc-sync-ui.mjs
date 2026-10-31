import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3106";
const profile = mkdtempSync(path.join(tmpdir(), "smashkart-rc-sync-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--remote-debugging-port=9228", "about:blank"], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, pendingSync, syncCount = 0, queueCount = 0, recovered = false;
try {
  let target;
  for (let i = 0; i < 100; i++) { try { target = (await (await fetch("http://127.0.0.1:9228/json")).json()).find(p => p.type === "page"); if (target) break; } catch {} await pause(100); }
  assert.ok(target); socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const fulfill = (requestId, body, responseCode = 200) => call("Fetch.fulfillRequest", { requestId, responseCode, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (task) { pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); }
    if (message.method !== "Fetch.requestPaused") return;
    const { requestId, request } = message.params;
    if (request.url.includes("/registrations/sync")) {
      syncCount++;
      if (syncCount === 1) pendingSync = requestId;
      else { recovered = true; fulfill(requestId, { success: true, registrationSync: { enabled: true, success: true, added: 1 } }); }
      return;
    }
    let body;
    if (request.url.includes("/api/queue")) { queueCount++; body = { success: true, queue: [{ id: "existing", rollNo: "TEST001", name: "Existing Player", status: "waiting", enqueuedAt: new Date().toISOString() }, ...(recovered ? [{ id: "recovered", rollNo: "TEST002", name: "Recovered Player", status: "waiting", enqueuedAt: new Date().toISOString() }] : [])] }; }
    else if (request.url.includes("db-status")) body = { success: true, status: { connectedToMongo: true, source: "mongodb", totalStudents: 9933 } };
    else if (request.url.includes("walk-ins")) body = { success: true, profiles: [] };
    else body = { success: true, players: [], history: [], roundNumber: 1, raceStarted: false, raceId: "test", targetLaps: 3 };
    fulfill(requestId, body).catch(() => {});
  });
  const evaluate = async expression => (await call("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  async function waitFor(expression) { for (let i = 0; i < 180; i++) { if (await evaluate(expression)) return; await pause(100); } throw new Error(expression); }
  await call("Page.enable"); await call("Fetch.enable", { patterns: [{ urlPattern: "*/api/*", requestStage: "Request" }] });
  await call("Page.navigate", { url: origin });
  await waitFor(`document.querySelector('#queue')?.innerText.includes('Existing Player') && document.body.innerText.includes('Database connected')`);
  assert.ok(pendingSync);
  await pause(3500);
  assert.ok(queueCount >= 2, "Queue continues refreshing during a slow RC request");
  assert.equal(syncCount, 1, "No overlapping recovery requests");
  await fulfill(pendingSync, { success: false, registrationSync: { success: false, message: "RC registrations could not be checked. Existing players are available; synchronization will retry automatically." } }, 503);
  await waitFor(`document.body.innerText.includes('RC registrations could not be checked')`);
  await waitFor(`document.querySelector('#queue')?.innerText.includes('Recovered Player') && !document.body.innerText.includes('RC registrations could not be checked')`);
  console.log("PASS: race controls stay responsive during slow recovery, RC outages show a notice, retries recover missed players, and recovery calls never overlap.");
} finally { socket?.close(); chrome.kill("SIGTERM"); await pause(500); rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
