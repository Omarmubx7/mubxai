import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { jsonResponse } from "@/lib/json-response";
import { prisma } from "@/lib/prisma";
import { evaluateAchievements } from "@/lib/gamification";
import { createAdminLog } from "@/lib/database";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { validationErrorResponse } from "@/lib/validation";
import { z } from "zod";

const studySessionSchema = z.object({
    course_id: z.number().optional().nullable(),
    duration_minutes: z.number().min(1).max(1440),
    type: z.enum(["study", "assignment", "exam_prep", "project", "reading", "other"]),
    notes: z.string().max(2000).optional().nullable(),
    date: z.string().optional().nullable()
});

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await req.json();
        const validation = studySessionSchema.safeParse(body);
        
        if (!validation.success) {
            return validationErrorResponse(validation.error.issues);
        }

        const { course_id, duration_minutes, type, notes, date } = body;

        const newSession = await prisma.studySession.create({
            data: {
                user_id: user.id,
                course_id: course_id ? Number(course_id) : null,
                duration_minutes: Number(duration_minutes),
                type,
                notes: notes || null,
                date: date ? new Date(date) : new Date()
            }
        });

        // Update gamification XP (Spec: 1 XP per 1 minute)
        const earnedXP = Math.floor(duration_minutes);

        // Fetch current gamification profile to calculate streak
        const currentProfile = await prisma.gamificationProfile.findUnique({
            where: { user_id: user.id }
        });

        const now = new Date();
        const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(now);
        const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);
        const today = new Date(tYear, tMonth - 1, tDay);

        let newCurrentStreak = 1;
        let newLongestStreak = 1;

        if (currentProfile && currentProfile.last_activity_date) {
            const lastActivity = new Date(currentProfile.last_activity_date);
            const lastStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(lastActivity);
            const [lYear, lMonth, lDay] = lastStr.split('-').map(Number);
            const lastActivityDay = new Date(lYear, lMonth - 1, lDay);

            const diffTime = Math.abs(today.getTime() - lastActivityDay.getTime());
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) {
                // Same day, streak remains the same
                newCurrentStreak = currentProfile.current_streak_days || 1;
            } else if (diffDays === 1) {
                // Next day, increment streak
                newCurrentStreak = (currentProfile.current_streak_days || 0) + 1;
            } else {
                // Streak broken, reset to 1
                newCurrentStreak = 1;
            }

            newLongestStreak = Math.max(currentProfile.longest_streak_days || 1, newCurrentStreak);
        }

        const gamificationUpdate = await prisma.gamificationProfile.upsert({
            where: { user_id: user.id },
            update: {
                xp: { increment: earnedXP },
                last_activity_date: now,
                current_streak_days: newCurrentStreak,
                longest_streak_days: newLongestStreak
            },
            create: {
                user_id: user.id,
                xp: earnedXP,
                level: 1,
                current_streak_days: 1,
                longest_streak_days: 1,
                last_activity_date: now
            }
        });

        // Trigger dynamic achievements evaluation
        await evaluateAchievements(user.id, Number(duration_minutes));

        createAdminLog({
            type: 'study_session',
            message: `Student ${user.student_id || user.email} logged ${duration_minutes}min study session (${type})`,
            details: { student_id: user.student_id, email: user.email, duration_minutes, type, course_id: course_id || null, earned_xp: earnedXP, new_total_xp: gamificationUpdate.xp, streak: newCurrentStreak },
            event_kind: 'study_session',
            target_id: user.student_id || String(user.id),
        }).catch(() => {});

        return jsonResponse({ session: newSession, earnedXP, newTotalXP: gamificationUpdate.xp });
    } catch (error) {
        console.error("POST StudySession Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const user = await resolveAuthenticatedUser(session);
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const searchParams = req.nextUrl.searchParams;
        const courseIdStr = searchParams.get("courseId");

        const sessions = await prisma.studySession.findMany({
            where: courseIdStr ? { user_id: user.id, course_id: Number(courseIdStr) } : { user_id: user.id },
            orderBy: { date: 'desc' },
            take: 50
        });

        return jsonResponse({ sessions });
    } catch (error) {
        console.error("GET StudySession Error:", error);
        return NextResponse.json({ error: "Server Error" }, { status: 500 });
    }
}
