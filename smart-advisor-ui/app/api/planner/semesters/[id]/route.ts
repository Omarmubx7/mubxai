import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { jsonResponse } from "@/lib/json-response";
import { prisma } from "@/lib/prisma";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { semesterSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";
import { createAdminLog } from "@/lib/database";

async function verifyAccess(_req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return { error: 'Unauthorized', status: 401 };

    const user = await resolveAuthenticatedUser(session);
    if (!user) return { error: 'User not found', status: 404 };
    return { user };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAccess(req);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const { id } = await params;
        const semesterId = parseInt(id, 10);

        const existing = await prisma.semester.findFirst({ where: { id: semesterId, user_id: auth.user!.id } });
        if (!existing) return NextResponse.json({ error: 'Semester not found' }, { status: 404 });

        const body = await req.json();
        const validation = semesterSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const { name, start_date, end_date, type, year } = validation.data;

        // Ensure year is a number for Prisma
        const finalYear = year !== undefined ? (typeof year === 'string' ? parseInt(year, 10) : year) : existing.year;

        const updated = await prisma.semester.update({
            where: { id: semesterId },
            data: {
                name: name !== undefined ? name : existing.name,
                type: type !== undefined ? type : existing.type,
                year: finalYear,
                start_date: start_date !== undefined ? (start_date ? new Date(start_date) : null) : existing.start_date,
                end_date: end_date !== undefined ? (end_date ? new Date(end_date) : null) : existing.end_date,
                updated_at: new Date()
            },
            include: { courses: true }
        });

        createAdminLog({
            type: 'semester_update',
            message: `Student ${auth.user!.student_id || auth.user!.email} updated semester "${updated.name}"`,
            details: { student_id: auth.user!.student_id, email: auth.user!.email, semester_id: semesterId, name: updated.name },
            event_kind: 'semester_update',
            target_id: String(semesterId),
        }).catch(() => {});

        return jsonResponse({ semester: updated });
    } catch (e) {
        console.error("PUT Semester Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAccess(req);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const { id } = await params;
        const semesterId = parseInt(id, 10);

        const existing = await prisma.semester.findFirst({ where: { id: semesterId, user_id: auth.user!.id } });
        if (!existing) return NextResponse.json({ error: 'Semester not found' }, { status: 404 });

        const semesterName = existing.name;
        await prisma.semester.delete({
            where: { id: semesterId }
        });

        createAdminLog({
            type: 'semester_delete',
            message: `Student ${auth.user!.student_id || auth.user!.email} deleted semester "${semesterName}"`,
            details: { student_id: auth.user!.student_id, email: auth.user!.email, semester_id: semesterId, name: semesterName },
            event_kind: 'semester_delete',
            target_id: String(semesterId),
        }).catch(() => {});

        return jsonResponse({ success: true });
    } catch (e) {
        console.error("DELETE Semester Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
