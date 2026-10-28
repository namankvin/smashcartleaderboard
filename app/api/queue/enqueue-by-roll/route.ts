import { NextRequest, NextResponse } from "next/server";
import { addToQueueByRollNo, getQueue } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rollNo = body.rollNo || body.roll_no;
    const name = body.name;

    if (!rollNo) {
      return NextResponse.json(
        { success: false, message: "Field 'rollNo' is required." },
        { status: 400 }
      );
    }

    const result = await addToQueueByRollNo(rollNo, name);
    const queue = await getQueue();
    const position = queue.findIndex((q) => q.rollNo.toUpperCase() === rollNo.trim().toUpperCase()) + 1;

    return NextResponse.json({
      ...result,
      queuePosition: position,
      totalInQueue: queue.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

