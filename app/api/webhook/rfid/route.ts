import { NextRequest, NextResponse } from "next/server";
import { addToQueueByRollNo, getQueue, resolveRFIDCard } from "@/lib/db";

// The upstream RFID service owns reading cards and resolving a card UID to a roll.
// Never interpret an unresolved UID as a student identity.
export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, message: "Send JSON containing a resolved rollNo." }, { status: 400 }); }
  if (process.env.INTEGRATION_TOKEN && request.headers.get("authorization") !== `Bearer ${process.env.INTEGRATION_TOKEN}`) return NextResponse.json({ success: false, message: "Invalid integration token." }, { status: 401 });
  const rollNo = body?.rollNo || body?.rollNumber || body?.roll_no || await resolveRFIDCard(body?.uid);
  if (typeof rollNo !== "string" || !rollNo.trim()) {
    return NextResponse.json({ success: false, message: "Unknown card. Pair its UID with a student roll number in RFID setup, or send a resolved rollNo." }, { status: 422 });
  }
  try {
    const result = await addToQueueByRollNo(rollNo, undefined, "rfid");
    const queue = await getQueue();
    return NextResponse.json({ ...result, queuePosition: result.item ? queue.findIndex(item => item.id === result.item!.id) + 1 : null }, { status: result.success ? 201 : 409 });
  } catch {
    return NextResponse.json({ success: false, message: "Registration failed. Check the contact directory and retry." }, { status: 500 });
  }
}
