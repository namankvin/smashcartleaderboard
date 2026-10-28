import { NextResponse } from "next/server";
import { getDbStatus } from "@/lib/db";

export async function GET() {
  try {
    const status = await getDbStatus();
    return NextResponse.json({
      success: true,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

