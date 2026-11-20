import { NextRequest, NextResponse } from 'next/server';
import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { buildCourseCreditMap, getCompletedEntryCode } from "@/lib/grading";
import { computeAcademicMetrics, getJordanDayKey } from "@/lib/planner-academics";
import curriculumData from '@/public/data/curriculum.json';
import curriculumRulesData from '@/public/data/curriculum_rules.json';

// Typed shape for degree_types from curriculum_rules.json
interface DegreeTypeEntry { major_keys: string[]; total_credits: number }
type CurriculumRulesRecord = Record<string, unknown> & { degree_types?: Record<string, DegreeTypeEntry> };

// In-memory cache for static curriculum data
let curriculumCache: Record<string, unknown> | null = null;
let rulesCache: CurriculumRulesRecord | null = null;

async function getCurriculum() {
    if (!curriculumCache) {
        try {
            curriculumCache = curriculumData as unknown as Record<string, unknown>;
        } catch (e) {
            console.error("Failed to load curriculum cache", e);
            return null;
        }
    }
    return curriculumCache;
}

async function getCurriculumRules() {
    if (!rulesCache) {
        try {
            rulesCache = curriculumRulesData as unknown as CurriculumRulesRecord;
        } catch (e) {
            console.error("Failed to load rules cache", e);
            return null;
        }
    }
    return rulesCache;
}

interface UpcomingEventLike {
    id: string | number;
    type: string;
    title: string;
    start_datetime: Date;
    course_id?: number | null;
    end_datetime?: Date;
}

function formatJordanTimezoneOffset(offsetMatch: RegExpExecArray | null): string {
    if (!offsetMatch) return '+03:00';
    const matched = offsetMatch[1];
    return matched.length <= 3 ? matched + ':00' : matched;
}

export async function GET(_req: NextRequest) {
    const session = await getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const baseUser = await resolveAuthenticatedUser(session);
    if (!baseUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    try {
        const user = await prisma.user.findUnique({
            where: { id: baseUser.id },
            include: {
                student_profile: true,
                gamification_profile: true
            }
        });

        if (!user) {
            return NextResponse.json({ error: "User profile not found in database" }, { status: 404 });
        }

        const profile = user.student_profile || await prisma.studentProfile.findFirst({
            where: {
                OR: [
                    { user_id: user.id },
                    { student_id: user.student_id ?? undefined }
                ]
            }
        });

        if (!profile) {
            return NextResponse.json({ 
                error: "No student profile configured",
                needs_onboarding: true,
                user: {
                    name: user.name,
                    email: user.email,
                    student_id: user.student_id || null,
                    role: user.role || "student",
                    major: "undecided"
                }
            }, { status: 200 });
        }

        const today = new Date();
        const jordanDateStr = getJordanDayKey(today);

        // Calculate the Jordan timezone offset for midnight on this date
        let todayStart: Date;
        try {
            const tzFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Amman', timeZoneName: 'longOffset' });
            const parts = tzFormatter.formatToParts(new Date(jordanDateStr + 'T00:00:00'));
            const tzName = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+03:00';
            const offsetMatch = /GMT([+-]\d{1,2})/.exec(tzName);
            const offset = formatJordanTimezoneOffset(offsetMatch);
            todayStart = new Date(`${jordanDateStr}T00:00:00${offset}`);
            if (Number.isNaN(todayStart.getTime())) throw new Error('Invalid todayStart computed');
        } catch (e) {
            console.error('Timezone parsing failed, falling back to +03:00', e);
            todayStart = new Date(`${jordanDateStr}T00:00:00+03:00`);
        }

        // 3. Parallel fetching
        const [
            semesters,
            googleToken,
            studySessions,
            quests,
            progress,
            curriculum,
            rules,
            calendarEvents
        ] = await Promise.all([
            prisma.semester.findMany({
                where: { user_id: user.id },
                include: { courses: true },
                orderBy: { year: 'desc' }
            }),
            prisma.integrationToken.findFirst({
                where: { user_id: user.id, provider: "google_calendar" }
            }),
            prisma.studySession.findMany({
                where: { user_id: user.id },
                include: { course: true },
                orderBy: { created_at: 'desc' },
                take: 100 
            }),
            prisma.quest.findMany({
                where: { user_id: user.id, status: "active" },
                include: { course: true }
            }),
            // Only query StudentProgress if we have both student_id and major
            (profile?.student_id && profile?.major)
                ? prisma.studentProgress.findUnique({
                    where: { 
                        student_id_major: { 
                            student_id: profile.student_id,
                            major: profile.major
                        } 
                    }
                })
                : Promise.resolve(null),
            getCurriculum(),
            getCurriculumRules(),
            prisma.calendarEvent.findMany({
                where: {
                    user_id: user.id,
                    start_datetime: { gte: todayStart }
                },
                orderBy: { start_datetime: 'asc' },
                take: 20
            })
        ]);

        console.log(`[PlannerSummary] Fetched ${semesters.length} semesters for userId=${user.id}`);
        if (semesters.length === 0) {
            console.warn(`[PlannerSummary] WARNING: No semesters found for userId=${user.id}`);
        }

        // Read-only: daily XP / GPA rewards are applied by POST /api/planner/rewards.
        const gamification = user.gamification_profile;

        // 4. Active Semester
        const currentSemester = (semesters && semesters.length > 0) 
            ? (semesters.find(s => {
                if (!s.start_date || !s.end_date) return false;
                return todayStart >= s.start_date && todayStart <= s.end_date;
              }) ?? semesters[0])
            : null;

        // 5. GPA — pure computation shared with the rewards endpoint.
        // No DB writes here; daily XP / GPA-history writes moved to
        // POST /api/planner/rewards (called once per Jordan day by the client).
        const { cgpa, classification, completedCredits } = computeAcademicMetrics({
            semesters,
            progressCompleted: progress?.completed,
            curriculum,
            profile,
        });

        // 6. Exams
        const nextWeek = new Date(todayStart);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const derivedExams: UpcomingEventLike[] = [];
        for (const sem of semesters) {
            if (sem.courses) {
                for (const course of sem.courses) {
                    if (course.midterm_date && course.midterm_date >= todayStart) {
                        derivedExams.push({
                            id: `exam-m-${course.id}`,
                            course_id: course.id,
                            type: "Midterm",
                            title: `${course.name} - Midterm`,
                            start_datetime: course.midterm_date
                        });
                    }
                    if (course.final_date && course.final_date >= todayStart) {
                        derivedExams.push({
                            id: `exam-f-${course.id}`,
                            course_id: course.id,
                            type: "Final",
                            title: `${course.name} - Final`,
                            start_datetime: course.final_date
                        });
                    }
                }
            }
        }

        const combinedEvents: UpcomingEventLike[] = [...calendarEvents, ...derivedExams]
            .sort((a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime());

        const nextWeekEvents = combinedEvents.filter(e => new Date(e.start_datetime) <= nextWeek);
        const upcomingEvents = nextWeekEvents.length > 0 ? nextWeekEvents.slice(0, 5) : combinedEvents.slice(0, 5);
        const upcomingEventsLabel = nextWeekEvents.length > 0 ? "Upcoming 7 Days" : "Upcoming Deadlines";

        // 7. Progress
        if (progress?.completed && curriculum) {
            let completedList: (string | { code: string; grade?: string })[] = [];
            try {
                const raw = progress.completed;
                completedList = typeof raw === 'string'
                    ? (JSON.parse(raw) as (string | { code: string; grade?: string })[])
                    : (raw as (string | { code: string; grade?: string })[]);
            } catch { /* ok */ }

            const creditMap = buildCourseCreditMap(curriculum);
            const _completedCreditsFromTracker = (completedList || []).reduce((total, entry) => {
                const code = getCompletedEntryCode(entry);
                if (!code) return total;
                return total + (creditMap.get(code) ?? 3);
            }, 0);
        }

        // 8. Trends
        const dayTrend = new Map<string, number>();
        const courseMap = new Map<number, { name: string; id: number; total: number }>();

        if (currentSemester?.courses) {
            for (const c of currentSemester.courses) {
                courseMap.set(c.id, { id: c.id, name: c.name, total: 0 });
            }
        }

        for (const session of studySessions) {
            const dateStr = session.created_at ? getJordanDayKey(new Date(session.created_at)) : '';
            if (dateStr) dayTrend.set(dateStr, (dayTrend.get(dateStr) || 0) + session.duration_minutes);
            
            if (session.course_id) {
                const existing = courseMap.get(session.course_id);
                if (existing) existing.total += session.duration_minutes;
            }
        }

        const studyTrends = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = getJordanDayKey(d);
            studyTrends.push({
                date: dateStr,
                minutes: dayTrend.get(dateStr) || 0
            });
        }

        const neglectedCourse = (currentSemester?.courses && currentSemester.courses.length > 0)
            ? (Array.from(courseMap.values()).sort((a, b) => a.total - b.total)[0] || null)
            : null;

        const total_study_minutes = studySessions.reduce((acc, s) => acc + s.duration_minutes, 0);

        // 9. Projections
        let TOTAL_DEGREE_CH = 135;
        const rulesWithTypes = rules as CurriculumRulesRecord | null;
        if (rulesWithTypes?.degree_types) {
            for (const type in rulesWithTypes.degree_types) {
                if (rulesWithTypes.degree_types[type].major_keys.includes(profile?.major || "")) {
                    TOTAL_DEGREE_CH = rulesWithTypes.degree_types[type].total_credits;
                    break;
                }
            }
        }

        const currentCompletedCH = completedCredits;
        const remainingCH = Math.max(0, TOTAL_DEGREE_CH - currentCompletedCH);
        const currentTotalPoints = (cgpa * currentCompletedCH);
        
        const projectedDistinction = remainingCH > 0 
            ? (currentTotalPoints + (4 * remainingCH)) / TOTAL_DEGREE_CH 
            : cgpa;
            
        const projectedMerit = remainingCH > 0 
            ? (currentTotalPoints + (3.2 * remainingCH)) / TOTAL_DEGREE_CH 
            : cgpa;

        // 10. Tips
        const dynamicTips = [];
        if (neglectedCourse) {
            dynamicTips.push({
                title: "Spaced Repetition",
                text: `You haven't studied ${neglectedCourse.name} much lately. Review it today!`,
                icon: "clock",
                color: "orange"
            });
        }
        if (upcomingEvents.length > 0) {
            dynamicTips.push({
                title: "Active Recall",
                text: `You have ${upcomingEvents.length} upcoming deadlines. Test yourself!`,
                icon: "target",
                color: "emerald"
            });
        }
        if (dynamicTips.length < 2) {
            dynamicTips.push({
                title: "Pomodoro Technique",
                text: "Try 25-minute study bursts with 5-minute breaks.",
                icon: "flame",
                color: "rose"
            });
        }

        // Safe-serialize the payload: convert BigInt → number, Date → ISO string
        // to prevent "TypeError: Do not know how to serialize a BigInt" which
        // truncates the response body and causes client-side JSON parse errors.
        function safeReplacer(_key: string, value: unknown) {
            if (typeof value === 'bigint') return Number(value);
            return value;
        }

        const payload = {
            cgpa,
            classification,
            currentSemester,
            allSemesters: semesters,
            upcomingEvents,
            upcomingEventsLabel,
            gamification,
            studyTrends,
            activeQuests: quests,
            projections: {
                distinction: projectedDistinction.toFixed(2),
                merit: projectedMerit.toFixed(2),
                remainingCH
            },
            studyTips: dynamicTips,
            studyLogStats: {
                total_study_minutes,
                study_sessions: studySessions.slice(0, 10),
                neglected_course: neglectedCourse ? { course: { name: neglectedCourse.name }, last_studied: null } : null
            },
            neglectedCourse: neglectedCourse ? {
                id: neglectedCourse.id,
                name: neglectedCourse.name,
                total_study_minutes: neglectedCourse.total
            } : null,
            google_calendar_connected: !!googleToken,
            google_preferences: googleToken?.metadata ?? {},
            user: {
                name: user.name,
                email: user.email,
                student_id: profile.student_id,
                major: profile?.major || "undecided",
                role: user.role || "student"
            }
        };

        return new Response(JSON.stringify(payload, safeReplacer), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error: unknown) {
        const correlationId = crypto.randomUUID();
        console.error("[GET Planner Summary Error]", { correlationId, message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined, error });
        return NextResponse.json({
            error: "Internal Server Error",
            correlationId,
        }, { status: 500 });
    }
}
