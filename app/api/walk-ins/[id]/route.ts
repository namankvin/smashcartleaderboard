export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getWalkInProfile, updateWalkIn } from "@/lib/db";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const profile = await getWalkInProfile(params.id);
    return NextResponse.json({ success: Boolean(profile), profile, message: profile ? undefined : "Walk-in profile not found." }, { status: profile ? 200 : 404 });
  } catch { return NextResponse.json({ success: false, message: "Could not load profile. Please retry." }, { status: 503 }); }
}
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, message: "Provide valid profile details." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, message: "Provide valid profile details." }, { status: 400 });
  try {
    const profile = await updateWalkIn(params.id, body);
    return NextResponse.json({ success: Boolean(profile), profile, message: profile ? "Walk-in details saved." : "Walk-in profile not found." }, { status: profile ? 200 : 404 });
  } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error && error.message.match(/required|must be|too long/) ? error.message : "Could not save details. Please retry." }, { status: 400 }); }
}
