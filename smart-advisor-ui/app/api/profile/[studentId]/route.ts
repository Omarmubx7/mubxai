
import { NextRequest, NextResponse } from 'next/server';
import { loadMajor } from '@/lib/database';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ studentId: string }> }
) {
    const session = await getServerSession();
    const { studentId: targetId } = await params;

    if (!targetId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await resolveAuthenticatedUser(session);
    if (!user || (user.student_id !== targetId && user.email !== targetId && String(user.id) !== targetId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const major = await loadMajor(targetId);
        const profile = await prisma.studentProfile.findUnique({
            where: { student_id: targetId },
            select: { previous_gpa: true, previous_credits: true }
        });

        return NextResponse.json({
            studentId: targetId,
            major,
            previous_gpa: profile?.previous_gpa || null,
            previous_credits: profile?.previous_credits || null
        });
    } catch (error) {
        console.error("[Profile GET] Error:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
