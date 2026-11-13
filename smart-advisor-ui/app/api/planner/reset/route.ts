import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

export async function DELETE(_req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // Wipe planner-derived data so all planner widgets reflect fresh state.
        const [calendarEvents, quests, studySessions, semesters, gpaHistory] = await prisma.$transaction([
            prisma.calendarEvent.deleteMany({ where: { user_id: user.id } }),
            prisma.quest.deleteMany({ where: { user_id: user.id } }),
            prisma.studySession.deleteMany({ where: { user_id: user.id } }),
            prisma.semester.deleteMany({ where: { user_id: user.id } }),
            prisma.gPAHistory.deleteMany({ where: { user_id: user.id } }),
            prisma.gamificationProfile.updateMany({
                where: { user_id: user.id },
                data: {
                    xp: 0,
                    level: 1,
                    current_streak_days: 0,
                    longest_streak_days: 0,
                    last_activity_date: null
                }
            })
        ]);

        return NextResponse.json(
            {
                success: true,
                message: "Planner reset successfully.",
                cleared: {
                    semesters: semesters.count,
                    study_sessions: studySessions.count,
                    quests: quests.count,
                    calendar_events: calendarEvents.count,
                    gpa_history: gpaHistory.count
                }
            },
            {
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
                }
            }
        );
    } catch (error) {
        console.error("DELETE Planner Reset Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
