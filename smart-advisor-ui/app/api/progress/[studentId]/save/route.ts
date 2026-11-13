
import { NextRequest, NextResponse } from 'next/server';
import { saveProgress, logVisitor, createAdminLog } from '@/lib/database';
import { getClientInfo } from '@/lib/client-info';
import { getSession } from "@/lib/session-server";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ studentId: string }> }
) {
    const session = await getSession();
    const { studentId: targetId } = await params;

    if (!targetId || targetId.length < 3) {
        return NextResponse.json({ error: 'Invalid student ID' }, { status: 400 });
    }

    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await resolveAuthenticatedUser(session);
    if (!user || (user.student_id !== targetId && user.email !== targetId && String(user.id) !== targetId)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { major, completed } = body as { major: string; completed: string[] };

        if (!major || !Array.isArray(completed)) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        await saveProgress(targetId, major, completed);

        createAdminLog({
            type: 'progress_update',
            message: `Student ${targetId} updated progress for ${major} (${completed.length} courses completed)`,
            details: { student_id: targetId, major, courses_completed: completed.length, courses: completed },
            event_kind: 'progress_save',
            target_id: targetId,
        }).catch(() => {});

        // Silent logging linked to student
        const info = await getClientInfo();
        info.student_id = targetId;
        logVisitor(info).catch(e => console.error("Logging failed", e));

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Save error:", e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
