import { NextResponse } from "next/server";
import { getActiveArena } from "@/lib/db";

// GET /api/game - Fetch active 3-player arena state, round number, and match history
export async function GET() {
  try {
    const arena = await getActiveArena();
    return NextResponse.json({
      success: true,
      ...arena,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

