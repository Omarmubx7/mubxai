import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/session-server";
import { resolveAuthenticatedUser } from '@/lib/resolve-user';
import { checkDailyAiUsageLimit } from '@/lib/ai-usage-limit';

export async function GET(request: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await resolveAuthenticatedUser(session);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Per-button limits (2 each) - dev email gets unlimited
    const suggestQuota = await checkDailyAiUsageLimit(user.id, 'suggest-courses', 2, user.email || undefined);
    const scheduleQuota = await checkDailyAiUsageLimit(user.id, 'generate-schedule', 2, user.email || undefined);

    return NextResponse.json({
        usage: {
            suggestCourses: { limit: suggestQuota.limit, usedToday: suggestQuota.usedToday, remaining: suggestQuota.remaining, resetAt: suggestQuota.resetAt.toISOString() },
            generateSchedule: { limit: scheduleQuota.limit, usedToday: scheduleQuota.usedToday, remaining: scheduleQuota.remaining, resetAt: scheduleQuota.resetAt.toISOString() },
        }
    });
}
