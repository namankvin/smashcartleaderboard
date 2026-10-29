import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { addToQueueByRollNo, getQueue, resolveRFIDCard, findStudentByRollNo } from "./db";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Cache-Control": "no-store",
};
const reply = (data: object, status: number) => NextResponse.json(data, { status, headers });
function matches(actual: string | null, expected: string | undefined) {
  if (!actual || !expected) return false;
  const left = Buffer.from(actual), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
export function rfidOptions() { return new NextResponse(null, { status: 204, headers }); }
export function rfidSpecification() {
  return reply({ success: true, service: "SmashKart RFID registration", method: "POST", endpoint: "/api/arcade/scan", fallback: "/api/rfid/scan", contentType: "application/json", authentication: "x-api-key", acceptedFields: ["rollNumber", "rollNo", "rfid", "uid"], example: { rollNumber: "23CEB0B10" } }, 200);
}
export async function handleRFIDScan(request: NextRequest, requireApiKey = true) {
  const suppliedKey = request.headers.get("x-api-key");
  if (requireApiKey) {
    if (!process.env.RFID_API_KEY) return reply({ success: false, message: "RFID API key is not configured on the server." }, 503);
    if (!matches(suppliedKey, process.env.RFID_API_KEY)) return reply({ success: false, message: "Missing or invalid x-api-key." }, 401);
  } else if (suppliedKey) {
    if (!matches(suppliedKey, process.env.RFID_API_KEY)) return reply({ success: false, message: "Invalid x-api-key." }, 401);
  } else if (process.env.INTEGRATION_TOKEN && !matches(request.headers.get("authorization"), `Bearer ${process.env.INTEGRATION_TOKEN}`)) {
    return reply({ success: false, message: "Invalid integration token." }, 401);
  }
  let body;
  try { body = await request.json(); }
  catch { return reply({ success: false, message: "Send valid JSON with rollNumber, rollNo, rfid or uid." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ success: false, message: "The JSON body must be an object." }, 400);
  const fields = ["rollNumber", "rollNo", "roll_no", "rfid", "uid"];
  if (fields.some(field => body[field] !== undefined && (typeof body[field] !== "string" || !body[field].trim()))) return reply({ success: false, message: "Registration identifiers must be non-empty text." }, 400);
  if (!fields.some(field => body[field] !== undefined)) return reply({ success: false, message: "Provide rollNumber, rollNo, rfid or uid." }, 400);
  try {
    let rollNo = body.rollNumber || body.rollNo || body.roll_no;
    if (!rollNo && body.uid) rollNo = await resolveRFIDCard(body.uid);
    if (!rollNo && body.rfid) {
      // Some readers send the resolved student roll in `rfid`; others send the UID.
      rollNo = await resolveRFIDCard(body.rfid);
      if (!rollNo) rollNo = (await findStudentByRollNo(body.rfid))?.rollNo;
    }
    if (!rollNo) return reply({ success: false, message: "Unknown card. Pair its UID with a student roll number in RFID setup, or send a resolved rollNumber." }, 422);
    const result = await addToQueueByRollNo(rollNo, undefined, "rfid");
    const queue = await getQueue();
    const position = result.item ? queue.findIndex(item => item.id === result.item!.id) + 1 : 0;
    return reply({ ...result, queuePosition: position || null, totalInQueue: queue.length, student: result.item ? { rollNo: result.item.rollNo, name: result.item.name, teamName: result.item.teamName, department: result.item.department } : undefined }, result.success ? 201 : 409);
  } catch { return reply({ success: false, message: "Could not save RFID registration. Please retry." }, 503); }
}
