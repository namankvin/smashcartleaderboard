import { NextRequest, NextResponse } from "next/server";
import { recordPlayerLap } from "@/lib/db";
import { TRACK_CARS } from "@/lib/cars";
export async function POST(request: NextRequest) {
  if (process.env.INTEGRATION_TOKEN && request.headers.get("authorization") !== `Bearer ${process.env.INTEGRATION_TOKEN}`) return NextResponse.json({ success: false, message: "Invalid integration token." }, { status: 401 });
  try {
    const body = await request.json();
    const slot = TRACK_CARS.indexOf(body.car) + 1;
    if (!slot || !["VISIBLE", "EXITING_TUNNEL"].includes(body.status) || body.in_tunnel === true) throw new Error("Only observed finish-line crossings for a known car are accepted.");
    if (typeof body.timestamp !== "number" || !Number.isFinite(body.timestamp)) throw new Error("A crossing timestamp in Unix seconds is required.");
    return NextResponse.json(await recordPlayerLap({ raceId: body.raceId, slot, lapNumber: body.lap, eventId: body.eventId, occurredAt: Math.round(body.timestamp * 1000), source: "tracker" }));
  } catch (error) { return NextResponse.json({ success: false, message: (error as Error).message }, { status: 400 }); }
}
