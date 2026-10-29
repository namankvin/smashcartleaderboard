import { NextRequest, NextResponse } from "next/server";
import { startNextThreeInArena } from "@/lib/db";

// Admin supplies exactly three queueIds in Red, Blue, Green order.
export async function POST(request: NextRequest) {
  let body;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, message: "Send JSON with three selected queueIds." }, { status: 400 }); }
  try {
    const queueIds = body?.queueIds;
    const result = await startNextThreeInArena(queueIds);
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

