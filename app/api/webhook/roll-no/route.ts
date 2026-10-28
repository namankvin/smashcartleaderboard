import { NextRequest, NextResponse } from "next/server";
import { addToQueueByRollNo, getQueue } from "@/lib/db";

// Helper for CORS headers so external websites can easily call this endpoint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST /api/webhook/roll-no
// Payload example: { "rollNo": "24ROB101" } or { "roll_no": "24ROB101" } or { "studentId": "..." }
export async function POST(request: NextRequest) {
  try {
    let rollNo = "";
    let studentName = "";

    // 1. Try reading JSON body
    try {
      const body = await request.json();
      rollNo = body.rollNo || body.roll_no || body.rollNumber || body.studentRoll || body.id || "";
      studentName = body.name || body.studentName || "";
    } catch {
      // 2. Fallback to URL search parameters (?rollNo=...)
      const { searchParams } = new URL(request.url);
      rollNo = searchParams.get("rollNo") || searchParams.get("roll_no") || "";
      studentName = searchParams.get("name") || "";
    }

    if (!rollNo || typeof rollNo !== "string" || !rollNo.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing roll number",
          message: "Please provide 'rollNo' in JSON body: { \"rollNo\": \"24ROB101\" }",
          example: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: { rollNo: "24ROB101" },
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Add to queue (automatically looks up name/details from Database)
    const result = await addToQueueByRollNo(rollNo, studentName);
    const queue = await getQueue();
    const position = queue.findIndex((q) => q.rollNo.toUpperCase() === rollNo.trim().toUpperCase()) + 1;

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          currentPosition: position > 0 ? position : null,
          item: result.item,
        },
        { status: 409, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        queuePosition: position,
        totalInQueue: queue.length,
        student: {
          rollNo: result.item?.rollNo,
          name: result.item?.name,
          teamName: result.item?.teamName,
          department: result.item?.department,
        },
        item: result.item,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// GET /api/webhook/roll-no - Also support GET requests for quick browser testing: /api/webhook/roll-no?rollNo=24ROB101
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rollNo = searchParams.get("rollNo") || searchParams.get("roll_no");

  if (!rollNo) {
    return NextResponse.json({
      success: true,
      service: "Robotics Arena Roll-No Webhook",
      status: "online",
      instructions: "Send a POST request with JSON { rollNo: 'YOUR_ROLL_NO' } or pass ?rollNo=... via GET for quick testing.",
    }, { headers: corsHeaders });
  }

  const result = await addToQueueByRollNo(rollNo);
  const queue = await getQueue();
  const position = queue.findIndex((q) => q.rollNo.toUpperCase() === rollNo.trim().toUpperCase()) + 1;

  return NextResponse.json({
    success: result.success,
    message: result.message,
    queuePosition: position,
    item: result.item,
  }, { headers: corsHeaders });
}

