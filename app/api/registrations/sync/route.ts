export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { syncRCRegistrations } from "@/lib/rcRegistrationSync";

export async function POST() {
  const result = await syncRCRegistrations();
  return NextResponse.json({ success: result.success, registrationSync: result }, { status: result.success ? 200 : 503 });
}
