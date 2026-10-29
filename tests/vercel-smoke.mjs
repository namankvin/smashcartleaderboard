import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3102"], {
  env: { ...process.env, VERCEL: "1", MONGODB_URI: "", CONTACTS_FILE: "/not-deployed/private-contacts.json" }, stdio: "ignore",
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Hosted-mode test server exited before becoming ready.");
    try { if ((await fetch("http://127.0.0.1:3102/")).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true);
  const health = await fetch("http://127.0.0.1:3102/api/health");
  assert.equal(health.status, 503);
  assert.equal((await health.json()).status, "unavailable");
  const queue = await fetch("http://127.0.0.1:3102/api/queue");
  assert.equal(queue.status, 500);
  assert.ok((await queue.json()).error.includes("MONGODB_URI"));
  const specification = await fetch("http://127.0.0.1:3102/api/arcade/scan");
  assert.equal(specification.status, 200);
  console.log("PASS: production Next.js server in Vercel mode serves pages/API metadata without local contacts and reports missing MongoDB instead of using memory storage.");
} finally {
  if (server.exitCode === null) { const exited = once(server, "exit"); server.kill("SIGTERM"); await exited; }
}
