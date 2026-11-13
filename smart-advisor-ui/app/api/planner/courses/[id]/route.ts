import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAdminLog } from "@/lib/database";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { updateCourseSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";

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
        const courseId = Number.parseInt(id, 10);

        // Ensure course belongs to user via semester
        const existing = await prisma.course.findFirst({
            where: { id: courseId },
            include: { semester: true }
        });

        if (!existing || existing.semester?.user_id !== auth.user!.id) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const body = await req.json();
        const validation = updateCourseSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const parsedBody = validation.data;

        const metadataFields: Array<keyof typeof parsedBody> = [
            'instructor_name',
            'location',
            'class_schedule',
            'final_mark',
            'status'
        ];
        const isMetadataUpdate = metadataFields.some((field) => parsedBody[field] !== undefined);
        const semesterHasDateRange = Boolean(existing.semester?.start_date) && Boolean(existing.semester?.end_date);

        if (isMetadataUpdate && !semesterHasDateRange) {
            return NextResponse.json(
                { error: 'Set semester start and end dates first before editing course metadata.' },
                { status: 400 }
            );
        }

        // Allow updates of attributes
        const updatedInfo: Parameters<typeof prisma.course.update>[0]["data"] = { updated_at: new Date() };

        // Core course fields
        if (parsedBody.code !== undefined) updatedInfo.code = String(parsedBody.code).toUpperCase();
        if (parsedBody.name !== undefined) updatedInfo.name = String(parsedBody.name);
        if (parsedBody.credits !== undefined) updatedInfo.credits = Number(parsedBody.credits);
        
        // Status and grade fields
        if (parsedBody.status !== undefined) updatedInfo.status = String(parsedBody.status);
        if (parsedBody.grade_letter !== undefined) updatedInfo.grade_letter = String(parsedBody.grade_letter);
        if (parsedBody.grade_point !== undefined) updatedInfo.grade_point = Number(parsedBody.grade_point);
        if (parsedBody.final_mark !== undefined) updatedInfo.final_mark = Number(parsedBody.final_mark);
        if (parsedBody.is_completed !== undefined) updatedInfo.is_completed = Boolean(parsedBody.is_completed);
        
        // Metadata fields
        if (parsedBody.instructor_name !== undefined) updatedInfo.instructor_name = parsedBody.instructor_name as string | null;
        if (parsedBody.location !== undefined) updatedInfo.location = parsedBody.location as string | null;
        if (parsedBody.class_schedule !== undefined) {
            updatedInfo.class_schedule = parsedBody.class_schedule as object;
        }
        if (parsedBody.midterm_date !== undefined) updatedInfo.midterm_date = parsedBody.midterm_date ? new Date(String(parsedBody.midterm_date)) : null;
        if (parsedBody.final_date !== undefined) updatedInfo.final_date = parsedBody.final_date ? new Date(String(parsedBody.final_date)) : null;

        const updated = await prisma.course.update({
            where: { id: courseId },
            data: updatedInfo
        });

        const changedFields = Object.keys(parsedBody).filter(k => k !== 'updated_at');
        createAdminLog({
            type: 'course_update',
            message: `Student ${auth.user!.student_id || auth.user!.email} updated course ${existing.code} (${changedFields.join(', ')})`,
            details: { student_id: auth.user!.student_id, email: auth.user!.email, course_code: existing.code, course_id: courseId, changed_fields: changedFields, is_completed: updated.is_completed, grade_letter: updated.grade_letter },
            event_kind: 'course_update',
            target_id: String(courseId),
            course_id: courseId,
        }).catch(() => {});

        // Award XP for course completion (Spec: +150 XP)
        let earnedXP = 0;
        if (updated.is_completed && !existing.is_completed) {
            earnedXP = 150;
            const { evaluateAchievements } = await import("@/lib/gamification");
            await prisma.gamificationProfile.upsert({
                where: { user_id: auth.user!.id },
                update: { xp: { increment: 150 } },
                create: { user_id: auth.user!.id, xp: 160, level: 1 } // 10 base + 150 bonus if creating new
            });
            await evaluateAchievements(auth.user!.id);
        }

        return NextResponse.json({ course: updated, xpEarned: earnedXP });
    } catch (e) {
        console.error("PUT Course Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAccess(req);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    try {
        const { id } = await params;
        const courseId = Number.parseInt(id, 10);

        const existing = await prisma.course.findFirst({
            where: { id: courseId },
            include: { semester: true }
        });

        if (!existing || existing.semester?.user_id !== auth.user!.id) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const courseCode = existing.code;
        await prisma.course.delete({
            where: { id: courseId }
        });

        createAdminLog({
            type: 'course_delete',
            message: `Student ${auth.user!.student_id || auth.user!.email} deleted course ${courseCode}`,
            details: { student_id: auth.user!.student_id, email: auth.user!.email, course_code: courseCode, course_id: courseId },
            event_kind: 'course_delete',
            target_id: String(courseId),
            course_id: courseId,
        }).catch(() => {});

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("DELETE Course Error:", e);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
