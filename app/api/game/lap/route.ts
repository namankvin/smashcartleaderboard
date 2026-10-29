import { NextRequest, NextResponse } from "next/server";
import { recordPlayerLap } from "@/lib/db";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await recordPlayerLap({ raceId: body.raceId, slot: body.slot, lapNumber: body.lapNumber, eventId: body.eventId, source: "manual" });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 }); }
}
