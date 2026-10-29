export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { updateArenaPlayer, updateArenaAll } from "@/lib/db";

// POST /api/game/timer
// Supports:
// 1. Master controls: { action: "start_all" | "stop_all" | "reset_all" }
// 2. Individual controls: { action: "start" | "stop" | "reset" | "penalty" | "disqualify", slot: 1 | 2 | 3, penaltySeconds?: 5 }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slot, penaltySeconds } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, message: "Action parameter is required." },
        { status: 400 }
      );
    }

    if (action === "start_all" || action === "stop_all" || action === "reset_all") {
      const players = await updateArenaAll(action);
      return NextResponse.json({
        success: true,
        action,
        players,
      });
    }

    if (!slot || slot < 1 || slot > 3) {
      return NextResponse.json(
        { success: false, message: "Valid player slot (1, 2, or 3) is required for individual action." },
        { status: 400 }
      );
    }

    const players = await updateArenaPlayer(slot, action, { penalty: penaltySeconds });
    return NextResponse.json({
      success: true,
      action,
      slot,
      players,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

