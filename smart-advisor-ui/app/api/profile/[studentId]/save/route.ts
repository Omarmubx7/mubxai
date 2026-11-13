
import { NextRequest, NextResponse } from 'next/server';
import { saveMajor, logVisitor, createAdminLog } from '@/lib/database';
import { getClientInfo } from '@/lib/client-info';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function POST(
    request: NextRequest,
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
        const { major } = await request.json() as { major: string };
        if (!major || !major.trim()) return NextResponse.json({ error: 'Missing major' }, { status: 400 });

        await saveMajor(targetId, major);

        createAdminLog({
            type: 'major_change',
            message: `Student ${targetId} selected/changed major to ${major}`,
            details: { student_id: targetId, major },
            event_kind: 'major_select',
            target_id: targetId,
        }).catch(() => {});

        // Silent logging linked to student
        const info = await getClientInfo();
        info.student_id = targetId;
        logVisitor(info).catch(e => console.error("Logging failed", e));

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Save profile error:", e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
