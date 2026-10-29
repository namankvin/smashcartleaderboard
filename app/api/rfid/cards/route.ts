export const runtime = "nodejs";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { listRFIDCards, pairRFIDCard } from "@/lib/db";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ success: true, cards: await listRFIDCards() }); }
  catch { return NextResponse.json({ success: false, message: "Could not load RFID pairings." }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  try { const body = await request.json(); return NextResponse.json(await pairRFIDCard(body.uid, body.rollNo)); }
  catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 }); }
}
