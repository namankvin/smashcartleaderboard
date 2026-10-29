export const runtime = "nodejs";
export const maxDuration = 30;

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getQueue, addToQueueByRollNo, removeWaitingParticipant, clearQueue } from "@/lib/db";

// GET /api/queue - Fetch all waiting participants
export async function GET() {
  try {
    const queue = await getQueue();
    return NextResponse.json({
      success: true,
      count: queue.length,
      queue,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/queue - Add participant to queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rollNo = body.rollNo || body.roll_no;
    const name = body.name;

    if (typeof rollNo !== "string" || !rollNo.trim()) {
      return NextResponse.json(
        { success: false, message: "Field 'rollNo' is required." },
        { status: 400 }
      );
    }

    const result = await addToQueueByRollNo(rollNo, name);
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// DELETE /api/queue - Remove participant by id or clear entire queue
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const clearAll = searchParams.get("clearAll") === "true";

    if (clearAll) {
      await clearQueue();
      return NextResponse.json({
        success: true,
        message: "Queue cleared completely.",
      });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Queue item 'id' is required to delete." },
        { status: 400 }
      );
    }

    const result = await removeWaitingParticipant(id);
    return NextResponse.json(result, { status: result.success ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

