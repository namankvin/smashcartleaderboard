import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Uses an isolated Chrome profile and only the temporary test server's records.
export async function verifyInterface(origin) {
  const profile = mkdtempSync(path.join(tmpdir(), "smashkart-browser-"));
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, "--remote-debugging-port=9225", "about:blank"], { stdio: "ignore" });
  let socket;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    let target;
    for (let i = 0; i < 100; i++) { try { const targets = await (await fetch("http://127.0.0.1:9225/json")).json(); target = targets.find(item => item.type === "page"); if (target) break; } catch {} await pause(100); }
    assert.ok(target, "Chrome debugging page is ready");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    let sequence = 0; const pending = new Map();
    socket.addEventListener("message", event => { const message = JSON.parse(event.data); const task = pending.get(message.id); if (task) { pending.delete(message.id); if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result); } });
    const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const value = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text); return value.result.value; };
    async function waitFor(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100); } throw new Error(`UI condition did not become true: ${expression}`); }
    const clickText = text => evaluate(`(() => { const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(text)} && !b.disabled && b.getClientRects().length); if (!button) throw new Error('Button not available'); button.click(); })()`);
    await call("Page.enable"); await call("Runtime.enable");
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await call("Page.navigate", { url: origin });
    await waitFor(`document.querySelector('#walkin-tab') && document.body.innerText.includes('Database connected')`);
    await evaluate(`document.querySelector('#walkin-tab').click()`);
    await waitFor(`document.querySelector('#walkin-registration').hidden === false`);
    await clickText("Add walk-in");
    await waitFor(`!!document.querySelector('[role="dialog"] input')`);
    await evaluate(`(() => { const input = document.querySelector('[role="dialog"] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'UI Test Visitor'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText("Register & add to queue");
    await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('#queue').innerText.includes('UI Test Visitor')`);
    const waiting = await (await fetch(origin + "/api/queue")).json();
    assert.equal(waiting.queue.length, 1, "UI registration queued one visitor");
    const original = waiting.queue[0];
    await clickText("→ Track 1");
    await waitFor(`document.querySelector('#tracks').innerText.includes('UI Test Visitor') && !document.querySelector('#queue').innerText.includes('UI Test Visitor')`);
    await clickText("Return to queue");
    await waitFor(`document.querySelector('#queue').innerText.includes('UI Test Visitor')`);
    const restored = await (await fetch(origin + "/api/queue")).json();
    assert.equal(restored.queue[0].id, original.id);
    assert.equal(restored.queue[0].enqueuedAt, original.enqueuedAt);
    await clickText("→ Track 2");
    await waitFor(`Array.from(document.querySelectorAll('.track-card'))[1].querySelector('.track-name')?.textContent === 'UI Test Visitor'`);
    await evaluate(`(() => { const select = document.querySelector('#move-2'); select.value = '3'; select.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await waitFor(`Array.from(document.querySelectorAll('.track-card'))[2].querySelector('.track-name')?.textContent === 'UI Test Visitor'`);
    await evaluate(`document.querySelector('#student-tab').click()`);
    const screenshot = await call("Page.captureScreenshot", { format: "png" });
    writeFileSync("/private/tmp/smashkart-setup-desktop.png", Buffer.from(screenshot.data, "base64"));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, "Desktop does not overflow horizontally");
    await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
    await pause(150);
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, "Mobile does not overflow horizontally");
    await evaluate(`document.querySelector('#tracks').scrollIntoView()`);
    const mobile = await call("Page.captureScreenshot", { format: "png" });
    writeFileSync("/private/tmp/smashkart-setup-mobile.png", Buffer.from(mobile.data, "base64"));
    await call("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    await clickText("Start race");
    await waitFor(`document.querySelector('#tracks').innerText.includes('Race in progress')`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('#tracks button')).some(button => button.textContent.includes('Return to queue'))`), false, "Running race hides reassignment controls");
    await clickText("Edit walk-in");
    await waitFor(`!!document.querySelector('[role="dialog"] input') && document.querySelector('[role="dialog"] input').value === 'UI Test Visitor'`);
    await evaluate(`(() => { const input = document.querySelector('[role="dialog"] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Updated During Race'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText("Save changes");
    await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('#tracks').innerText.includes('Updated During Race')`);
    const racing = await (await fetch(origin + "/api/game")).json();
    assert.equal(racing.players.find(player => player.rollNo === original.rollNo).isRunning, true);
    assert.equal(await evaluate(`getComputedStyle(document.documentElement).colorScheme`), "dark");
    for (let number = 1; number <= 3; number++) {
      await clickText(`Record lap ${number}`);
      await waitFor(`Array.from(document.querySelectorAll('.track-card'))[2].querySelectorAll('.lap-list li').length === ${number}`);
    }
    const completed = await (await fetch(origin + "/api/game")).json();
    assert.equal(completed.players.find(player => player.rollNo === original.rollNo).isRunning, false);
    assert.equal(completed.players.find(player => player.rollNo === original.rollNo).status, "finished");
    await clickText("Add walk-in");
    await waitFor(`!!document.querySelector('[role="dialog"] input')`);
    await evaluate(`(() => { const input = document.querySelector('[role="dialog"] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'UI Remove Guest'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
    await clickText("Register & add to queue");
    await waitFor(`!document.querySelector('[role="dialog"]') && document.querySelector('#queue').innerText.includes('UI Remove Guest') && document.querySelector('.profile-list').innerText.includes('UI Remove Guest')`);
    await evaluate(`(() => { window.confirm = () => true; document.querySelector('button[aria-label="Remove UI Remove Guest from waiting queue"]').click(); })()`);
    await waitFor(`!document.querySelector('#queue').innerText.includes('UI Remove Guest') && !document.querySelector('.profile-list').innerText.includes('UI Remove Guest')`);
    await evaluate(`document.querySelector('.tools-panel').open = true`);
    await clickText("RFID API details & test");
    await waitFor(`document.querySelector('#rfid-title')?.textContent === 'Embedded team RFID API'`);
    assert.equal(await evaluate(`document.querySelector('[role="dialog"]').innerText.includes(${JSON.stringify(origin + "/api/arcade/scan")})`), true);
    assert.equal(await evaluate(`document.querySelector('[role="dialog"]').innerText.includes(${JSON.stringify(origin + "/api/rfid/scan")})`), true);
    await evaluate(`(() => { const inputs = document.querySelectorAll('[role="dialog"] input'); for (const [index,value] of ['TEST-STUDENT', 'browser-test-rfid-key'].entries()) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(inputs[index], value); inputs[index].dispatchEvent(new Event('input', { bubbles: true })); } })()`);
    await clickText("Send test registration");
    await waitFor(`Array.from(document.querySelectorAll('[role="dialog"] pre[role="status"]')).some(item => item.textContent.includes('"success": true'))`);
    await clickText("Close");
    await clickText("RFID API details & test");
    assert.equal(await evaluate(`document.querySelector('[role="dialog"] input[type="password"]').value`), "", "Tester clears the entered key when closed");
    await clickText("Close");
    console.log("PASS: desktop/mobile browser flow for walk-in registration, queue assignment, return with preserved position, moving tracks, editing a profile during a running race, and immediate profile removal from the walk-in table.");
  } finally {
    socket?.close(); chrome.kill("SIGTERM");
    await pause(600); rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
  }
}
