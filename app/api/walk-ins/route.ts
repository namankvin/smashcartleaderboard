export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createWalkIn, listWalkIns } from "@/lib/db";

export async function GET(request: NextRequest) {
  try { return NextResponse.json({ success: true, profiles: await listWalkIns(request.nextUrl.searchParams.get("q") || "") }); }
  catch { return NextResponse.json({ success: false, message: "Could not load walk-in profiles. Please retry." }, { status: 503 }); }
}
export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, message: "Provide a valid registration form." }, { status: 400 }); }
  try { return NextResponse.json({ success: true, ...await createWalkIn(body) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error && error.message.match(/required|must be|too long|Provide/) ? error.message : "Could not save registration. Please retry." }, { status: 400 }); }
}
