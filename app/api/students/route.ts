import { NextRequest, NextResponse } from "next/server";
import { getAllStudents, insertStudent, bulkInsertStudents } from "@/lib/db";
import { Student } from "@/lib/types";

// GET /api/students - List all or search students (?q=... or ?rollNo=...)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || searchParams.get("rollNo") || undefined;
    const students = await getAllStudents(search);

    return NextResponse.json({
      success: true,
      count: students.length,
      students,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/students - Add single student or bulk import array of students
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Check if bulk insert
    if (Array.isArray(body)) {
      const res = await bulkInsertStudents(body);
      return NextResponse.json({
        success: true,
        message: `Imported ${res.count} student(s) successfully.`,
        count: res.count,
      });
    }

    if (Array.isArray(body.students)) {
      const res = await bulkInsertStudents(body.students);
      return NextResponse.json({
        success: true,
        message: `Imported ${res.count} student(s) successfully.`,
        count: res.count,
      });
    }

    // Single student
    const { rollNo, name, teamName, department, year, contact, email } = body;
    if (!rollNo || !name) {
      return NextResponse.json(
        { success: false, message: "Both rollNo and name are required." },
        { status: 400 }
      );
    }

    const student: Student = { rollNo, name, teamName, department, year, contact, email };
    const saved = await insertStudent(student);

    return NextResponse.json({
      success: true,
      message: `Student ${name} (${rollNo}) registered successfully.`,
      student: saved,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

