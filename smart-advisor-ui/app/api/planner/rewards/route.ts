import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session-server';
import { prisma } from '@/lib/prisma';
import { resolveAuthenticatedUser } from '@/lib/resolve-user';
import {
    applyPlannerRewards,
    getCurriculum,
} from '@/lib/planner-academics';

export const dynamic = 'force-dynamic';

/**
 * Daily gamification / GPA rewards.
 *
 * These are database writes and used to run inside GET /api/planner/summary,
 * which meant every dashboard refresh wrote to the DB. The client calls this
 * endpoint at most once per Jordan day, keeping GET read-only and static-friendly.
 */
export async function POST() {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUser = await resolveAuthenticatedUser(session);
    if (!baseUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    try {
        const user = await prisma.user.findUnique({
            where: { id: baseUser.id },
            include: { student_profile: true, gamification_profile: true },
        });

        if (!user) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

        const profile = user.student_profile || await prisma.studentProfile.findFirst({
            where: {
                OR: [
                    { user_id: user.id },
                    { student_id: user.student_id ?? undefined },
                ],
            },
        });

        const [semesters, progress] = await Promise.all([
            prisma.semester.findMany({
                where: { user_id: user.id },
                include: { courses: true },
            }),
            (profile?.student_id && profile?.major)
                ? prisma.studentProgress.findUnique({
                    where: {
                        student_id_major: {
                            student_id: profile.student_id,
                            major: profile.major,
                        },
                    },
                })
                : Promise.resolve(null),
        ]);

        await applyPlannerRewards(
            user,
            {
                semesters,
                progressCompleted: progress?.completed,
                curriculum: getCurriculum(),
                profile,
            },
            new Date()
        );

        return NextResponse.json({ success: true }, {
            headers: { 'Cache-Control': 'no-store, max-age=0' },
        });
    } catch (e: unknown) {
        console.error('[Planner Rewards Error]', e instanceof Error ? e.message : String(e));
        return NextResponse.json({ error: 'Failed to apply rewards' }, { status: 500 });
    }
}
