import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { jsonResponse } from "@/lib/json-response";
import { prisma } from "@/lib/prisma";
import { createAdminLog } from "@/lib/database";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { semesterSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";

async function saveSemester(userId: number, payload: {
    type: string;
    name: string;
    year: number;
    start_date: string | null;
    end_date: string | null;
}) {
    const existingSemester = await prisma.semester.findFirst({
        where: {
            user_id: userId,
            year: payload.year,
            type: payload.type,
        },
        include: { courses: true },
    });

    if (existingSemester) {
        return prisma.semester.update({
            where: { id: existingSemester.id },
            data: {
                name: payload.name,
                start_date: payload.start_date ? new Date(payload.start_date) : null,
                end_date: payload.end_date ? new Date(payload.end_date) : null,
            },
            include: { courses: true },
        });
    }

    return prisma.semester.create({
        data: {
            user_id: userId,
            type: payload.type,
            year: payload.year,
            name: payload.name,
            start_date: payload.start_date ? new Date(payload.start_date) : null,
            end_date: payload.end_date ? new Date(payload.end_date) : null,
        },
        include: { courses: true },
    });
}

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const semesters = await prisma.semester.findMany({
            where: { user_id: user.id },
            include: { courses: true },
            orderBy: [{ year: 'desc' }, { type: 'desc' }]
        });

        // Return both `semesters` and legacy `allSemesters` key to remain
        // compatible with clients expecting either shape.
        return jsonResponse({ semesters, allSemesters: semesters });
    } catch (error) {
        console.error("GET Semesters Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const validation = semesterSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const { type, name, start_date, end_date, year } = validation.data;

        if (!type || !year || !name) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const newSemester = await saveSemester(user.id, {
            type,
            name,
            year: Number(year),
            start_date: start_date ?? null,
            end_date: end_date ?? null,
        });

        createAdminLog({
            type: 'semester_create',
            message: `Student ${user.student_id || user.email} created semester "${name}" (${type} ${year})`,
            details: { student_id: user.student_id, email: user.email, semester_name: name, type, year },
            event_kind: 'semester_create',
            target_id: String(newSemester.id),
        }).catch(() => {});

        console.log(`[SemesterCreate] Created semester: id=${newSemester.id}, type=${type}, year=${year}, userId=${user.id}`);
        return jsonResponse({ semester: newSemester });
    } catch (error) {
        console.error("POST Semester Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
