export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getDbStatus } from "@/lib/db";
export async function GET() {
  try {
    const status = await getDbStatus();
    if (!status.connectedToMongo) return NextResponse.json({ status: "unavailable", database: "not-connected" }, { status: 503 });
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch { return NextResponse.json({ status: "unavailable", database: "not-connected" }, { status: 503 }); }
}
