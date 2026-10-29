import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
let client;
try {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("Missing MONGODB_URI in the local settings.");
  const file = process.env.CONTACTS_FILE || path.join(process.cwd(), "data", "contacts.json");
  const records = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(records)) throw new Error("The contacts file must contain an array.");
  const contacts = new Map();
  let skipped = 0;
  let duplicates = 0;
  for (const record of records) {
    if (!record || typeof record.rollNumber !== "string" || typeof record.name !== "string" || !record.rollNumber.trim() || !record.name.trim()) {
      skipped++;
      continue;
    }
    const rollNo = record.rollNumber.trim().toUpperCase();
    if (contacts.has(rollNo)) duplicates++;
    contacts.set(rollNo, { rollNo, name: record.name.trim(), email: typeof record.mail === "string" ? record.mail.trim() : "" });
  }
  if (!contacts.size) throw new Error("No valid contacts found; nothing was imported.");
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || "robotics_db");
  const students = db.collection("students");
  await students.createIndex({ rollNo: 1 }, { unique: true, name: "unique_student_roll" });
  const rows = Array.from(contacts.values());
  const importedAt = new Date().toISOString();
  let inserted = 0;
  let updated = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const result = await students.bulkWrite(batch.map(student => ({ updateOne: {
      filter: { rollNo: student.rollNo },
      update: { $set: { ...student, directorySource: "contacts.json" }, $setOnInsert: { registeredAt: importedAt } },
      upsert: true,
    } })), { ordered: true });
    inserted += result.upsertedCount;
    updated += result.modifiedCount;
  }
  let verified = 0;
  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const saved = await students.find({ rollNo: { $in: batch.map(student => student.rollNo) } }, { projection: { rollNo: 1, name: 1, email: 1 } }).toArray();
    const byRoll = new Map(saved.map(student => [student.rollNo, student]));
    for (const expected of batch) {
      const actual = byRoll.get(expected.rollNo);
      if (!actual || actual.name !== expected.name || actual.email !== expected.email) throw new Error("Imported contact verification failed.");
      verified++;
    }
  }
  console.log(JSON.stringify({ success: true, sourceRecords: records.length, uniqueContacts: rows.length, duplicateRecords: duplicates, skippedRecords: skipped, inserted, updated, verified, totalStudents: await students.countDocuments(), uniqueRollIndex: true }));
} catch (error) {
  // Do not emit connection strings or credentials in connection error messages.
  console.error(JSON.stringify({ success: false, errorType: error.name, code: error.code || null, message: "Contact import did not complete. Check directory format, database access, and duplicate roll numbers before retrying." }));
  process.exitCode = 1;
} finally {
  if (client) await client.close();
}
