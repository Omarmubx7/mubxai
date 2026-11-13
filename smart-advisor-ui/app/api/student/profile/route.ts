import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";
import { createAdminLog } from "@/lib/database";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { studentProfileSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";
import { jsonResponse } from "@/lib/json-response";

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const validation = studentProfileSchema.safeParse(body);
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }
        const { previous_gpa, previous_credits } = validation.data;

        const baseUser = await resolveAuthenticatedUser(session);
        if (!baseUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const user = await prisma.user.findUnique({
            where: { id: baseUser.id },
            include: { student_profile: true }
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const resolvedStudentId = user.student_id || user.student_profile?.student_id || String(user.id);
        if (!resolvedStudentId) {
            return NextResponse.json({ error: "Student ID not set" }, { status: 400 });
        }

        const updatedProfile = await prisma.studentProfile.upsert({
            where: { student_id: resolvedStudentId },
            update: {
                previous_gpa: previous_gpa == null ? null : Number(previous_gpa),
                previous_credits: previous_credits == null ? null : Number(previous_credits),
                updated_at: BigInt(Date.now()),
            },
            create: {
                student_id: resolvedStudentId,
                major: "computing_bsc", // Default fallback
                previous_gpa: previous_gpa == null ? null : Number(previous_gpa),
                previous_credits: previous_credits == null ? null : Number(previous_credits),
                updated_at: BigInt(Date.now()),
                user: {
                    connect: { id: user.id }
                }
            }
        });

        createAdminLog({
            type: 'profile_update',
            message: `Student ${resolvedStudentId} updated academic profile (GPA: ${previous_gpa}, Credits: ${previous_credits})`,
            details: { student_id: resolvedStudentId, email: user.email, previous_gpa, previous_credits },
            event_kind: 'profile_update',
            target_id: resolvedStudentId,
        }).catch(() => {});

        return jsonResponse(
            { success: true, profile: { ...updatedProfile, updated_at: Number(updatedProfile.updated_at) } },
            { status: 200 }
        );

    } catch (e: unknown) {
        console.error("Failed to update student profile", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
