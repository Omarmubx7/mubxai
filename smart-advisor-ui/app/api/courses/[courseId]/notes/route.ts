import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { getCourseNotes, saveCourseNotes, initDB, createAdminLog } from "@/lib/database";
import { updateCourseNotesSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = session.user.student_id || session.user.email || 'unknown';
  const { courseId } = await params;
  const normalizedCourseId = String(courseId).trim().toUpperCase();

  try {
    await initDB();
    const notesStr = await getCourseNotes(studentId, normalizedCourseId);

    // Check if notes are already JSON
    let notes = notesStr;
    try {
      if (notesStr && (notesStr.startsWith('{"') || notesStr.startsWith('['))) {
        notes = JSON.parse(notesStr);
      }
    } catch {
      // Keep as string if parsing fails
    }

    return NextResponse.json({
      notes,
      updatedAt: new Date().toISOString() // In a real app, this would come from the DB
    });
  } catch (e) {
    console.error("Notes GET Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ courseId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const studentId = session.user.student_id || session.user.email || 'unknown';
  const { courseId } = await params;
  const normalizedCourseId = String(courseId).trim().toUpperCase();
  const body = await req.json();
  const validation = updateCourseNotesSchema.safeParse(body);
  if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
  }
  const { notes } = validation.data;

  try {
    const notesStr = typeof notes === 'string' ? notes : JSON.stringify(notes);
    await initDB();
    await saveCourseNotes(studentId, normalizedCourseId, notesStr);

    createAdminLog({
      type: 'course_notes',
      message: `Student ${studentId} updated notes for course ${normalizedCourseId}`,
      details: { student_id: studentId, course_id: normalizedCourseId },
      event_kind: 'notes_update',
      target_id: String(studentId),
    }).catch(() => {});

    return NextResponse.json({ success: true, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error("Notes POST Error:", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
