import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
const profile = mkdtempSync(path.join(tmpdir(), "smashkart-connection-test-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--remote-debugging-port=9226", "about:blank"], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, phase = "failure", requests = 0;
try {
  let target;
  for (let attempt = 0; attempt < 100; attempt++) { try { target = (await (await fetch("http://127.0.0.1:9226/json")).json()).find(page => page.type === "page"); if (target) break; } catch {} await pause(100); }
  assert.ok(target);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.id) { const task = pending.get(message.id); if (task) { pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); } }
    if (message.method === "Fetch.requestPaused") {
      requests++; const { requestId, request } = message.params; const current = phase;
      setTimeout(() => {
        const body = current === "failure" ? { success: false, error: "Simulated slow database failure" } : request.url.includes("db-status") ? { success: true, status: { connectedToMongo: true, source: "mongodb", totalStudents: 9933 } } : request.url.endsWith("/queue") ? { success: true, queue: [] } : { success: true, players: [], history: [], roundNumber: 1, raceStarted: false, raceId: "test", targetLaps: 3 };
        call("Fetch.fulfillRequest", { requestId, responseCode: current === "failure" ? 503 : 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") }).catch(() => {});
      }, 5000);
    }
  });
  const evaluate = async expression => (await call("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  async function waitFor(expression) { for (let attempt = 0; attempt < 160; attempt++) { if (await evaluate(expression)) return; await pause(100); } throw new Error(`UI did not update: ${expression}`); }
  await call("Page.enable");
  await call("Fetch.enable", { patterns: ["/api/queue", "/api/game", "/api/system/db-status"].map(route => ({ urlPattern: `*${route}`, requestStage: "Request" })) });
  await call("Page.navigate", { url: origin });
  await waitFor(`document.body.innerText.includes('Database unavailable')`);
  assert.ok(requests <= 3, "Polling does not overlap a slow pending refresh");
  assert.equal(await evaluate(`document.body.innerText.includes('Saved records have not been cleared')`), true);
  phase = "success";
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry connection').click()`);
  await waitFor(`document.body.innerText.includes('Database connected') && !document.body.innerText.includes('Database connection failed')`);
  console.log("PASS: a five-second database failure shows Database unavailable despite the three-second poll; retry recovers to Database connected without overlapping refreshes.");
} finally {
  socket?.close(); chrome.kill("SIGTERM"); await pause(600); rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
}
