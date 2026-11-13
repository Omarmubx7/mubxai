import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function GET(_req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const quests = await prisma.quest.findMany({
            where: {
                user_id: user.id,
                status: 'active'
            },
            orderBy: { created_at: 'desc' }
        });

        // Initialize default quests if empty (Basic onboarding gamification schema)
        if (quests.length === 0) {
            const defaultQuest = await prisma.quest.create({
                data: {
                    user_id: user.id,
                    type: 'study_time',
                    target_value: 60, // 60 minutes
                    current_value: 0,
                    status: 'active',
                    scope: 'global'
                }
            });
            return NextResponse.json({ quests: [defaultQuest] });
        }

        return NextResponse.json({ quests });

    } catch (error) {
        console.error("GET Quests Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
