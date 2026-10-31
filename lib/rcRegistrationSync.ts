import { reconcileRCRegistrations, RCRegistration } from "./db";

const SOURCE = "https://rc-tz-26.vercel.app/api/waiting-list";
export type RCRegistrationSync = { enabled: boolean; success: boolean; added: number; handled: number; pending: number; checkedAt?: string; message?: string };
let inFlight: Promise<RCRegistrationSync> | undefined;
let last: RCRegistrationSync | undefined;
let nextCheckAt = 0;

export function parseRCRegistrations(body: unknown): RCRegistration[] {
  if (!body || typeof body !== "object" || !("success" in body) || body.success !== true || !("list" in body) || !Array.isArray(body.list)) {
    throw new Error("Invalid RC registration response.");
  }
  const byId = new Map<string, RCRegistration>();
  for (const row of body.list) {
    if (!row || typeof row !== "object" || typeof row.id !== "string" || !row.id || row.id.length > 200 ||
      typeof row.rollNumber !== "string" || !row.rollNumber.trim() || row.rollNumber.trim().length > 250 ||
      typeof row.registeredAt !== "string" || !Number.isFinite(Date.parse(row.registeredAt))) continue;
    const entry: RCRegistration = { id: row.id, rollNumber: row.rollNumber.trim(), registeredAt: row.registeredAt };
    if (typeof row.name === "string" && row.name.trim().length <= 250) entry.name = row.name.trim();
    if (typeof row.mail === "string" && row.mail.trim().length <= 250) entry.mail = row.mail.trim();
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values()).sort((a, b) => Date.parse(a.registeredAt) - Date.parse(b.registeredAt) || a.id.localeCompare(b.id));
}

export async function syncRCRegistrations(): Promise<RCRegistrationSync> {
  if (process.env.RC_REGISTRATION_SYNC === "false" || (process.env.VERCEL !== "1" && process.env.RC_REGISTRATION_SYNC !== "true")) {
    return { enabled: false, success: true, added: 0, handled: 0, pending: 0 };
  }
  if (inFlight) return inFlight;
  if (Date.now() < nextCheckAt && last) return last;
  inFlight = (async () => {
    try {
      const response = await fetch(SOURCE, { cache: "no-store", signal: AbortSignal.timeout(4000), redirect: "error" });
      if (!response.ok) throw new Error("RC registration source is unavailable.");
      const entries = parseRCRegistrations(await response.json());
      const result = await reconcileRCRegistrations(entries);
      last = { enabled: true, success: true, ...result, checkedAt: new Date().toISOString() };
    } catch (error) {
      const failure = error as { name?: string; code?: string | number; codeName?: string };
      console.error("RC registration sync failed", { errorType: failure.name, code: failure.code, codeName: failure.codeName });
      last = { enabled: true, success: false, added: 0, handled: 0, pending: 0, checkedAt: new Date().toISOString(), message: "RC registrations could not be checked. Existing players are available; synchronization will retry automatically." };
    }
    nextCheckAt = Date.now() + 5000;
    return last;
  })();
  try { return await inFlight; } finally { inFlight = undefined; }
}
