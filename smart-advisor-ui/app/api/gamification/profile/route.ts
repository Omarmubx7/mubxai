import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function GET(_req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const baseUser = await resolveAuthenticatedUser(session);
        if (!baseUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const user = await prisma.user.findUnique({
            where: { id: baseUser.id },
            include: { gamification_profile: true, user_badges: { include: { badge: true } } }
        });

        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        let profile = user.gamification_profile;

        // If no profile exists, create a default one
        if (!profile) {
            profile = await prisma.gamificationProfile.create({
                data: {
                    user_id: user.id,
                    xp: 10,
                    level: 1,
                    current_streak_days: 0,
                    longest_streak_days: 0,
                    last_activity_date: new Date()
                }
            });
        }

        // Safeguard: Ensure XP is never negative
        if (profile.xp !== null && profile.xp < 0) {
            profile = await prisma.gamificationProfile.update({
                where: { user_id: user.id },
                data: { xp: 0 }
            });
        }

        return NextResponse.json({
            profile,
            badges: user.user_badges.map(ub => ub.badge)
        });

    } catch (error) {
        console.error("GET Gamification Profile Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
