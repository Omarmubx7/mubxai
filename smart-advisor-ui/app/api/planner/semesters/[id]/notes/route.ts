import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { jsonResponse } from "@/lib/json-response";
import { prisma } from "@/lib/prisma";
import { createAdminLog } from "@/lib/database";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { createSemesterNoteSchema, updateSemesterNoteSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const semesterId = Number.parseInt(id, 10);

    const user = await resolveAuthenticatedUser(session);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    try {
        const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
        if (!semester || semester.user_id !== user.id) {
            return NextResponse.json({ error: "Semester not found or access denied" }, { status: 403 });
        }
        const notes = await prisma.semesterNote.findMany({
            where: { semester_id: semesterId },
            orderBy: { created_at: "desc" }
        });
        return jsonResponse({ notes });
    } catch (e) {
        console.error("Fetch notes error:", e);
        return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const semesterId = Number.parseInt(id, 10);

    const user = await resolveAuthenticatedUser(session);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    try {
        const semester = await prisma.semester.findUnique({ where: { id: semesterId } });
        if (!semester || semester.user_id !== user.id) {
            return NextResponse.json({ error: "Semester not found or access denied" }, { status: 403 });
        }
        const body = await req.json();
        const validation = createSemesterNoteSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const { title, notes, content } = validation.data;

        const newNote = await prisma.semesterNote.create({
            data: {
                semester_id: semesterId,
                title: title || "Untitled Note",
                notes: notes || "",
                content: JSON.parse(JSON.stringify(content || {}))
            }
        });

        createAdminLog({
            type: 'semester_notes',
            message: `Student ${session.user.student_id || session.user.email} created note "${title || 'Untitled'}" in semester ${semesterId}`,
            details: { student_id: session.user.student_id, email: session.user.email, semester_id: semesterId, note_id: newNote.id, title },
            event_kind: 'note_create',
            target_id: String(newNote.id),
        }).catch(() => {});

        return jsonResponse({ note: newNote });
    } catch (e) {
        console.error("Create note error:", e);
        return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const validation = updateSemesterNoteSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const { id, title, notes, content } = validation.data;

        // Verify ownership: check that the note's semester belongs to the authenticated user
        const user = await resolveAuthenticatedUser(session);

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const note = await prisma.semesterNote.findUnique({
            where: { id: Number(id) },
            include: { semester: true }
        });

        if (!note || note.semester.user_id !== user.id) {
            return NextResponse.json({ error: "Note not found or access denied" }, { status: 403 });
        }

        const updated = await prisma.semesterNote.update({
            where: { id: Number(id) },
            data: {
                title: title ?? undefined,
                notes: notes ?? undefined,
                content: content !== undefined ? JSON.parse(JSON.stringify(content)) : undefined,
                updated_at: new Date()
            }
        });
        return jsonResponse({ note: updated });
    } catch (e) {
        console.error("Update note error:", e);
        return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

        // Verify ownership before deletion
        const user = await resolveAuthenticatedUser(session);

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const note = await prisma.semesterNote.findUnique({
            where: { id: Number(id) },
            include: { semester: true }
        });

        if (!note || note.semester.user_id !== user.id) {
            return NextResponse.json({ error: "Note not found or access denied" }, { status: 403 });
        }

        await prisma.semesterNote.delete({
            where: { id: Number(id) }
        });
        return jsonResponse({ success: true });
    } catch (e) {
        console.error("Delete note error:", e);
        return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
    }
}
