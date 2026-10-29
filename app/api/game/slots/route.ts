import { NextRequest, NextResponse } from "next/server";
import {
  moveTrackPlayer,
  returnAllToQueue,
  vacateArenaSlot,
  assignPlayerToArenaSlot,
  editArenaPlayer,
  unbarContestant,
  getActiveArena,
} from "@/lib/db";

// POST /api/game/slots - Manage individual arena seats (vacate, assign, edit, unbar)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, slot, rollNo, reason, sendToQueue, barFromNextRound, overrideBar, name, teamName, department } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, message: "Action parameter is required ('vacate', 'assign', 'edit', 'unbar')." },
        { status: 400 }
      );
    }

    if (action === "move") {
      const result = await moveTrackPlayer(slot, body.toSlot);
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }
    if (action === "return_all") {
      const result = await returnAllToQueue();
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // 1. Vacate a slot
    if (action === "vacate") {
      if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
        return NextResponse.json(
          { success: false, message: "Valid slot (1, 2, or 3) is required to vacate." },
          { status: 400 }
        );
      }
      const result = await vacateArenaSlot(slot, {
        reason,
        sendToQueue,
        barFromNextRound,
      });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // 2. Assign / Fill a slot by roll number
    if (action === "assign") {
      if (!Number.isInteger(slot) || slot < 1 || slot > 3 || typeof rollNo !== "string" || !rollNo.trim()) {
        return NextResponse.json(
          { success: false, message: "Slot (1-3) and rollNo are required to assign." },
          { status: 400 }
        );
      }
      const result = await assignPlayerToArenaSlot(slot, rollNo, { overrideBar });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // 3. Edit details of player in slot
    if (action === "edit") {
      if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
        return NextResponse.json(
          { success: false, message: "Slot (1-3) is required to edit." },
          { status: 400 }
        );
      }
      const result = await editArenaPlayer(slot, { name, teamName, rollNo, department });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    // 4. Unbar a contestant
    if (action === "unbar") {
      if (!rollNo) {
        return NextResponse.json(
          { success: false, message: "rollNo is required to unbar." },
          { status: 400 }
        );
      }
      const unbarred = await unbarContestant(rollNo);
      const arena = await getActiveArena();
      return NextResponse.json({
        success: unbarred,
        message: unbarred ? `Unbarred ${rollNo}. They can now participate.` : "Record not found.",
        withdrawn: arena.withdrawn,
      });
    }

    return NextResponse.json(
      { success: false, message: `Unknown slot action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

