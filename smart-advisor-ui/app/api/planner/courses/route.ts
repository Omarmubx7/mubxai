import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createAdminLog } from "@/lib/database";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { createCourseSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const validation = createCourseSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const { semester_id, name, code, credits, instructor_name, location } = validation.data;

        // Verify semester belongs to user
        const semester = await prisma.semester.findFirst({
            where: { id: Number(semester_id), user_id: user.id }
        });

        if (!semester) return NextResponse.json({ error: 'Semester not found' }, { status: 404 });

        // Check for duplicate course in same semester
        const existingCourse = await prisma.course.findFirst({
            where: { 
                semester_id: Number(semester_id), 
                code: code.toUpperCase() 
            }
        });

        if (existingCourse) {
            return NextResponse.json({ 
                error: 'Course already exists in this semester. Please choose a different course or edit the existing one.' 
            }, { status: 400 });
        }

        const newCourse = await prisma.course.create({
            data: {
                semester_id: Number(semester_id),
                name,
                code: code.toUpperCase(),
                credits: Number(credits),
                instructor_name: instructor_name || null,
                location: location || null,
                status: 'planned'
            }
        });

        createAdminLog({
            type: 'course_create',
            message: `Student ${user.student_id || user.email} added course ${code.toUpperCase()} (${name}) to semester`,
            details: { student_id: user.student_id, email: user.email, course_code: code.toUpperCase(), course_name: name, credits, semester_id },
            event_kind: 'course_create',
            target_id: String(newCourse.id),
            course_id: newCourse.id,
        }).catch(() => {});

        return NextResponse.json({ course: newCourse });
    } catch (error) {
        console.error("POST Course Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
