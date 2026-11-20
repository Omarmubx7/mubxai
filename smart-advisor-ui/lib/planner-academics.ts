/**
 * Shared, side-effect-free academic computations plus the (write-heavy)
 * gamification rewards that used to run on every GET /api/planner/summary.
 *
 * GET now only computes and reads. The client calls POST /api/planner/rewards
 * once per Jordan day to apply daily XP / GPA-improvement rewards.
 */

import { prisma } from '@/lib/prisma';
import { evaluateAchievements } from '@/lib/gamification';
import {
    calculateSemesterGpa,
    getClassification,
    buildCourseCreditMap,
    getCompletedEntryCode,
} from '@/lib/grading';
import curriculumData from '@/public/data/curriculum.json';

export function getJordanDayKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Amman' }).format(date);
}

export function getCompletedEntryGrade(entry: unknown): string {
    if (typeof entry !== 'object' || entry === null) return 'M';
    const grade = (entry as { grade?: unknown }).grade;
    return typeof grade === 'string' ? grade : 'M';
}

let curriculumCache: Record<string, unknown> | null = null;

export function getCurriculum(): Record<string, unknown> | null {
    if (!curriculumCache) {
        try {
            curriculumCache = curriculumData as unknown as Record<string, unknown>;
        } catch {
            return null;
        }
    }
    return curriculumCache;
}

type CourseLike = {
    grade_letter: string | null;
    credits: number;
    code: string;
};

type SemesterLike = { courses: CourseLike[] };

type ProfileLike = {
    previous_gpa?: unknown;
    previous_credits?: unknown;
};

export interface AcademicInputs {
    semesters: SemesterLike[];
    progressCompleted: unknown;
    curriculum: Record<string, unknown> | null;
    profile: ProfileLike | null;
}

/** Pure computation — no DB access, safe to call on GET and on POST. */
export function computeAcademicMetrics({ semesters, progressCompleted, curriculum, profile }: AcademicInputs) {
    const allCompletedCourses = semesters.flatMap(s =>
        s.courses
            .filter(c => c.grade_letter && ['D', 'M', 'P', 'U'].includes(c.grade_letter))
            .map(c => ({ grade: c.grade_letter as string, credits: c.credits, code: c.code }))
    );

    let totalQualityPoints = 0;
    let gpaCredits = 0;
    let completedCredits = 0;

    for (const course of allCompletedCourses) {
        totalQualityPoints += calculateSemesterGpa([course]) * course.credits;
        gpaCredits += course.credits;
        completedCredits += course.credits;
    }

    // Add graded entries from the completion tracker that are not already
    // graded in the planner.
    if (progressCompleted && curriculum) {
        let completedList: (string | { code: string; grade?: string })[] = [];
        try {
            const raw = progressCompleted;
            completedList = typeof raw === 'string'
                ? (JSON.parse(raw) as (string | { code: string; grade?: string })[])
                : (raw as (string | { code: string; grade?: string })[]);
        } catch { /* ok */ }

        const creditMap = buildCourseCreditMap(curriculum);
        const alreadyGraded = new Set(allCompletedCourses.map(c => c.code));

        for (const entry of completedList || []) {
            const code = getCompletedEntryCode(entry);
            if (!code || alreadyGraded.has(code)) continue;

            const credits = creditMap.get(code) ?? 3;
            const grade = getCompletedEntryGrade(entry);

            if (grade !== 'X') completedCredits += credits;

            if (['D', 'M', 'P', 'U'].includes(grade)) {
                totalQualityPoints += calculateSemesterGpa([{ grade, credits }]) * credits;
                gpaCredits += credits;
            }

            alreadyGraded.add(code);
        }
    }

    if (profile?.previous_gpa && profile?.previous_credits) {
        totalQualityPoints += Number(profile.previous_gpa) * Number(profile.previous_credits);
        gpaCredits += Number(profile.previous_credits);
        completedCredits += Number(profile.previous_credits);
    }

    const cgpa = gpaCredits > 0 ? Math.round((totalQualityPoints / gpaCredits) * 100) / 100 : 0;
    const classification = getClassification(cgpa).label;

    return { cgpa, classification, completedCredits };
}

type GamificationLike = { last_activity_date: Date | null };
type UserWithGamification = { id: number; gamification_profile: GamificationLike | null };

async function handleDailyGamificationXP(user: UserWithGamification, today: Date) {
    let gamification = user.gamification_profile;
    if (gamification == null) {
        gamification = await prisma.gamificationProfile.create({
            data: { user_id: user.id, xp: 10, level: 1, last_activity_date: today },
        });
    } else {
        const lastDate = gamification.last_activity_date ? new Date(gamification.last_activity_date) : null;
        const lastDateStr = lastDate ? getJordanDayKey(lastDate) : '';
        const todayStr = getJordanDayKey(today);

        if (lastDateStr !== todayStr) {
            gamification = await prisma.gamificationProfile.update({
                where: { user_id: user.id },
                data: { xp: { increment: 10 }, last_activity_date: today },
            });
            await evaluateAchievements(user.id);
        }
    }
    return gamification;
}

async function handleGpaImprovement(userId: number, cgpa: number, classification: string) {
    try {
        const lastHistory = await prisma.gPAHistory.findFirst({
            where: { user_id: userId },
            orderBy: { created_at: 'desc' },
        });

        if (cgpa > 0 && (lastHistory === null || cgpa > lastHistory.cumulative_gpa)) {
            const diff = lastHistory ? cgpa - lastHistory.cumulative_gpa : cgpa;
            if (diff >= 0.1) {
                const xpAward = Math.floor(diff / 0.1) * 50;
                await prisma.gamificationProfile.update({
                    where: { user_id: userId },
                    data: { xp: { increment: 10 + xpAward } },
                });
                await prisma.gPAHistory.create({
                    data: { user_id: userId, cumulative_gpa: cgpa, classification },
                });
                await evaluateAchievements(userId);
            }
        }
    } catch (e) {
        console.error('GPA Improvement handler error:', e);
    }
}

/** Applies all gamification writes that used to happen inside the GET request. */
export async function applyPlannerRewards(
    user: UserWithGamification,
    inputs: AcademicInputs,
    today: Date
): Promise<void> {
    const { cgpa, classification } = computeAcademicMetrics(inputs);
    await handleDailyGamificationXP(user, today);
    await handleGpaImprovement(user.id, cgpa, classification);
}
