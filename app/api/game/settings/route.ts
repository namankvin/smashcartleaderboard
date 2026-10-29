import { NextRequest, NextResponse } from "next/server";
import { configureRace } from "@/lib/db";
export async function POST(request: NextRequest) {
  try { const body = await request.json(); return NextResponse.json(await configureRace(body.targetLaps)); }
  catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 }); }
}
