import { NextResponse } from "next/server";
import { startNextThreeInArena } from "@/lib/db";

// POST /api/game/start-next - Selects the top 3 persons from the queue and enters them into the active arena
export async function POST() {
  try {
    const result = await startNextThreeInArena();
    return NextResponse.json(result, {
      status: result.success ? 200 : 400,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

