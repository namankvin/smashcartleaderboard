import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const origin = process.env.TEST_BASE_URL || "http://127.0.0.1:3104";
const profile = mkdtempSync(path.join(tmpdir(), "smashkart-leaderboard-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--remote-debugging-port=9227", "about:blank"], { stdio: "ignore" });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let i = 0; i < 100; i++) { try { target = (await (await fetch("http://127.0.0.1:9227/json")).json()).find(p => p.type === "page"); if (target) break; } catch {} await pause(100); }
  assert.ok(target);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let sequence = 0; const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const players = ["Unfinished racer", "Finished racer", "Walk-in racer"].map((name, i) => ({ rank: i + 1, rollNo: i === 2 ? "GUEST-test" : `24TEST${i}`, name, bestTimeMs: 4291 + i * 1000, bestTimeFormatted: `00:0${4 + i}.291`, roundsPlayed: 1, lapsCompleted: 2, status: i === 0 ? "dnf" : "finished" }));
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    const task = pending.get(message.id);
    if (task) { pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); }
    if (message.method === "Fetch.requestPaused") {
      const q = new URL(message.params.request.url).searchParams.get("q") || "";
      const body = { success: true, totalParticipantsCount: 3, topThree: players, allParticipants: players.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) };
      call("Fetch.fulfillRequest", { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "application/json" }], body: Buffer.from(JSON.stringify(body)).toString("base64") }).catch(() => {});
    }
  });
  const evaluate = async expression => { const r = await call("Runtime.evaluate", { expression, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
  async function waitFor(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); } throw new Error(`UI condition failed: ${expression}`); }
  await call("Page.enable");
  await call("Fetch.enable", { patterns: [{ urlPattern: "*/api/leaderboard*", requestStage: "Request" }] });
  await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await call("Page.navigate", { url: origin + "/leaderboard" });
  await waitFor(`document.querySelectorAll('tbody tr').length === 3`);
  assert.equal(await evaluate(`document.querySelector('tbody tr').innerText.includes('00:04.291')`), true, "DNF lap remains visible");
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('th')).some(th => th.textContent === 'Result')`), false);
  assert.equal(await evaluate(`document.querySelectorAll('.podium-card').length`), 3);
  assert.equal(await evaluate(`new Set(Array.from(document.querySelectorAll('.podium-card')).map(e => getComputedStyle(e).borderTopColor)).size`), 3);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  writeFileSync("/private/tmp/smashkart-lap-leaderboard-desktop.png", Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
  await pause(200);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, "Mobile page fits screen");
  writeFileSync("/private/tmp/smashkart-lap-leaderboard-mobile.png", Buffer.from((await call("Page.captureScreenshot", { format: "png" })).data, "base64"));
  await evaluate(`(() => { const e = document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, 'Walk-in'); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await waitFor(`document.querySelectorAll('tbody tr').length === 1`);
  assert.equal(await evaluate(`document.querySelector('tbody tr .leaderboard-rank').innerText.includes('3')`), true);
  assert.equal(await evaluate(`document.querySelectorAll('.podium-card').length`), 3);
  console.log("PASS: DNF lap shown, Result column removed, three medal colors, desktop/mobile layout and search preserving global ranks/podium.");
} finally { socket?.close(); chrome.kill("SIGTERM"); await pause(500); rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); }
