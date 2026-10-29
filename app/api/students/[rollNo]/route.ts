export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { findStudentByRollNo } from "@/lib/db";

// GET /api/students/[rollNo] - Find student by roll number
export async function GET(
  _request: NextRequest,
  { params }: { params: { rollNo: string } }
) {
  try {
    const { rollNo } = params;
    if (!rollNo) {
      return NextResponse.json(
        { success: false, message: "Roll number parameter missing." },
        { status: 400 }
      );
    }

    const student = await findStudentByRollNo(rollNo);
    if (!student) {
      return NextResponse.json(
        { success: false, message: `Student with roll number '${rollNo}' not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      student,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

