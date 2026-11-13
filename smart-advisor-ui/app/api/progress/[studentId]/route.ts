
import { NextRequest, NextResponse } from 'next/server';
import { loadProgress } from '@/lib/database';
import { getSession } from "@/lib/session-server";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ studentId: string }> }
) {
    const session = await getSession();
    const { studentId: targetId } = await params;
    const major = request.nextUrl.searchParams.get('major') ?? 'default';

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
        const completed = await loadProgress(targetId, major);
        return NextResponse.json({ studentId: targetId, major, completed });
    } catch (error) {
        console.error("[Progress GET] Error loading progress:", error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
