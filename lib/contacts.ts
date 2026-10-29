import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Student } from "./types";

// Kept on the server: the contact directory is never bundled into browser code.
let contacts: Student[] | undefined;
export function getContacts(): Student[] {
  if (contacts) return contacts;
  const file = process.env.CONTACTS_FILE || path.join(process.cwd(), "data", "contacts.json");
  if (!existsSync(file) && !process.env.CONTACTS_FILE) return contacts = [];
  const records: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(records)) throw new Error("contacts.json must contain an array.");
  const byRoll = new Map<string, Student>();
  for (const record of records) {
    if (!record || typeof record.rollNumber !== "string" || typeof record.name !== "string") continue;
    const rollNo = record.rollNumber.trim().toUpperCase();
    const name = record.name.trim();
    if (rollNo && name) byRoll.set(rollNo, { rollNo, name, email: typeof record.mail === "string" ? record.mail.trim() : undefined });
  }
  contacts = Array.from(byRoll.values());
  return contacts;
}
