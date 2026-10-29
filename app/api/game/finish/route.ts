export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { finishRound } from "@/lib/db";

// POST /api/game/finish - Complete round, record results, clear playing arena
export async function POST() {
  try {
    const result = await finishRound();
    if (!result) {
      return NextResponse.json(
        { success: false, message: "No active contestants in arena to finish." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Round #${result.round.roundNumber} recorded successfully!`,
      round: result.round,
      allHistory: result.allHistory,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

