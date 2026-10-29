export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getLeaderboardData } from "@/lib/db";

// GET /api/leaderboard - Overall competition leaderboard with top 3, total counts, and roll no search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("rollNo") || searchParams.get("q") || undefined;

    const data = await getLeaderboardData(search);

    return NextResponse.json({
      success: true,
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

