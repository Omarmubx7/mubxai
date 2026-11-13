import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { getStudySchedule } from "@/lib/groq";
import { logAIUsage } from "@/lib/ai-logger";
import { prisma } from "@/lib/prisma";
import { checkDailyAiUsageLimit } from "@/lib/ai-usage-limit";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

type ScheduleCourse = {
    code: string;
    name: string;
    credits: number;
    midterm_date?: string;
    final_date?: string;
};

type ScheduleRequest = {
    major?: string;
    semesterType?: string;
    semesterName?: string;
    semesterStartDate?: string | null;
    semesterEndDate?: string | null;
    weeklyHours?: number;
    courses?: ScheduleCourse[];
};

type ScheduleSession = {
    course: string;
    hours: number;
    focus: string;
};

type ScheduleDay = {
    day: string;
    sessions: ScheduleSession[];
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const FOCUS_TEMPLATES = [
    "Review lecture notes and summarize key ideas",
    "Work through practice problems",
    "Revise quizzes, labs, and past assignments",
    "Memorize formulas and definitions",
    "Prepare exam questions and flashcards",
    "Do a short active-recall session",
];

function buildFallbackStudySchedule(courses: ScheduleCourse[], weeklyHours: number) {
    if (courses.length === 0) {
        return { weeklyPlan: [], examTips: ["Add at least one course to generate a study plan."] };
    }

    const hoursPerDay = Math.max(0.5, Number((weeklyHours / 7).toFixed(1)));
    
    // Sort courses by credits (highest first) to prioritize them
    const sortedCourses = [...courses].sort((a, b) => b.credits - a.credits);
    
    // Distribute courses across the week to avoid cyclical repetition
    const weeklyPlan: ScheduleDay[] = DAY_NAMES.map((day, index) => {
        // Pick 1-2 courses per day depending on hours
        const sessions = [];
        
        // Primary course for the day (rotates through courses, heavily weighted to high credits)
        const primaryCourse = sortedCourses[index % sortedCourses.length];
        const focusPrimary = FOCUS_TEMPLATES[(index * 2) % FOCUS_TEMPLATES.length];
        
        sessions.push({
            course: primaryCourse.name,
            hours: hoursPerDay > 2 ? Math.round(hoursPerDay * 0.7) : hoursPerDay,
            focus: focusPrimary,
        });
        
        // If they study more than 2 hours a day and have multiple courses, add a secondary course
        if (hoursPerDay > 2 && sortedCourses.length > 1) {
            const secondaryCourse = sortedCourses[(index + 1) % sortedCourses.length];
            const focusSecondary = FOCUS_TEMPLATES[(index * 2 + 1) % FOCUS_TEMPLATES.length];
            
            sessions.push({
                course: secondaryCourse.name,
                hours: Number((hoursPerDay - Math.round(hoursPerDay * 0.7)).toFixed(1)),
                focus: focusSecondary,
            });
        }

        return { day, sessions };
    });

    return {
        weeklyPlan,
        examTips: [
            "Start with the course that has the highest credit load.",
            "Keep one day light for revision and catch-up.",
            `Focus extra review on ${sortedCourses[0].name} before exams.`,
        ],
    };
}

function parseScheduleResponse(raw: string) {
    try {
        // First, try to extract JSON if it's embedded in text
        const jsonMatch = /\{[\s\S]*\}/.exec(raw);
        const jsonStr = jsonMatch ? jsonMatch[0] : raw;
        
        const parsed = JSON.parse(jsonStr) as unknown;
        
        // Validate structure
        if (typeof parsed === 'object' && parsed !== null) {
            const obj = parsed as Record<string, unknown>;
            if (Array.isArray(obj.weeklyPlan) && Array.isArray(obj.examTips)) {
                return parsed;
            }
        }
        
        console.warn("[AI] Response lacks weeklyPlan or examTips arrays, using fallback format");
        return { weeklyPlan: [], examTips: [], raw };
    } catch (e) {
        console.warn("[AI] Failed to parse response as JSON:", e);
        return { weeklyPlan: [], examTips: [], raw };
    }
}

function parseScheduleInput(body: ScheduleRequest & { semesterId?: number }) {
    const semesterId = body.semesterId;
    const major = typeof body.major === "string" ? body.major : "";
    const semesterType = typeof body.semesterType === "string" ? body.semesterType : "";
    const semesterName = typeof body.semesterName === "string" ? body.semesterName : "";
    const semesterStartDate = typeof body.semesterStartDate === "string" ? body.semesterStartDate : null;
    const semesterEndDate = typeof body.semesterEndDate === "string" ? body.semesterEndDate : null;
    const weeklyHours =
        typeof body.weeklyHours === "number" && Number.isFinite(body.weeklyHours)
            ? Math.max(4, Math.min(35, body.weeklyHours))
            : 14;
    const courses = Array.isArray(body.courses)
        ? body.courses.filter(
            (c: unknown): c is ScheduleCourse =>
                typeof c === "object" &&
                c !== null &&
                typeof (c as ScheduleCourse).code === "string" &&
                typeof (c as ScheduleCourse).name === "string" &&
                typeof (c as ScheduleCourse).credits === "number"
        )
        : [];

    return { semesterId, major, semesterType, semesterName, semesterStartDate, semesterEndDate, weeklyHours, courses };
}

async function persistSchedule(semesterId: number, userId: number, parsed: { weeklyPlan?: unknown[]; examTips?: unknown[]; raw?: unknown }) {
    try {
        const existingSemester = await prisma.semester.findFirst({
            where: { id: semesterId, user_id: userId || -1 },
            select: { id: true },
        });

        if (existingSemester) {
            await prisma.semester.update({
                where: { id: existingSemester.id },
                data: {
                    study_schedule: structuredClone(parsed.weeklyPlan ?? []) as import('@prisma/client').Prisma.InputJsonValue,
                    ai_exam_tips: structuredClone(parsed.examTips ?? []) as import('@prisma/client').Prisma.InputJsonValue
                }
            });
            console.log(`[AI] Persisted schedule to semester ${semesterId}`);
        } else {
            console.warn(`[AI] Skipped schedule persistence for unauthorized or missing semester ${semesterId}`);
        }
    } catch (dbError) {
        console.error("[AI] Failed to persist schedule to DB", dbError);
    }
}

async function handleScheduleRequest(request: NextRequest, userId: number, startTime: number) {
    let status: 'success' | 'error' | 'timeout' = 'success';
    let errorMessage: string | undefined;

    try {
        const body = await request.json() as ScheduleRequest & { semesterId?: number };
        const { semesterId, major, semesterType, semesterName, semesterStartDate, semesterEndDate, weeklyHours, courses } = parseScheduleInput(body);

        if (!major || courses.length === 0) {
            status = 'error';
            errorMessage = 'Invalid payload';
            await logAIUsage({
                userId,
                endpoint: 'generate-schedule',
                featureName: 'Study Schedule Generation',
                status,
                errorMessage,
                responseTimeMs: Date.now() - startTime,
            });
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        let parsed: { weeklyPlan?: unknown[]; examTips?: unknown[]; raw?: unknown };
        try {
            const { content, usage } = await getStudySchedule({
                major,
                semesterType,
                semesterName,
                semesterStartDate,
                semesterEndDate,
                courses,
                weeklyHours,
            });
            parsed = parseScheduleResponse(content) as { weeklyPlan?: unknown[]; examTips?: unknown[]; raw?: unknown };

            await logAIUsage({
                userId,
                endpoint: 'generate-schedule',
                featureName: 'Study Schedule Generation',
                modelUsed: usage.modelUsed,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                status,
                errorMessage,
                responseTimeMs: Date.now() - startTime,
                metadata: {
                    major,
                    coursesCount: courses.length,
                    weeklyHours,
                    semesterId
                },
            });
        } catch (error) {
            status = 'error';
            errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error("[AI] Schedule generation provider failed:", {
                error: errorMessage,
                major,
                coursesCount: courses.length,
                weeklyHours,
                timestamp: new Date().toISOString(),
                stack: error instanceof Error ? error.stack : undefined
            });
            
            // Log the error to database
            await logAIUsage({
                userId,
                endpoint: 'generate-schedule',
                featureName: 'Study Schedule Generation',
                status: 'error',
                errorMessage,
                responseTimeMs: Date.now() - startTime,
                metadata: {
                    major,
                    coursesCount: courses.length,
                    weeklyHours,
                    semesterId
                },
            });
            
            // Return error response with fallback schedule
            const userMessage = errorMessage.includes('API') || errorMessage.includes('rate') 
                ? "AI service rate limited. Using standard schedule instead."
                : "AI service temporarily unavailable. Using standard schedule instead.";
            
            return NextResponse.json({
                error: "AI schedule generation failed",
                details: userMessage,
                fallback: buildFallbackStudySchedule(courses, weeklyHours)
            }, { status: 503 });
        }

        // PERSIST TO DATABASE if semesterId is provided
        if (semesterId && parsed && status === 'success') {
            await persistSchedule(semesterId, userId, parsed);
        }

        // Validate that we have actual schedule data
        const hasValidSchedule = Array.isArray(parsed?.weeklyPlan) && parsed.weeklyPlan.length > 0;
        
        if (!hasValidSchedule) {
            console.warn("[AI] AI returned empty/invalid schedule, using fallback");
            parsed = buildFallbackStudySchedule(courses, weeklyHours);
        }

        return NextResponse.json({ result: parsed });
    } catch (error: unknown) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : String(error);
        console.error("generate-schedule error", error);

        // Log the error
        await logAIUsage({
            userId,
            endpoint: 'generate-schedule',
            featureName: 'Study Schedule Generation',
            status,
            errorMessage,
            responseTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({ 
            error: "Failed to generate schedule"
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await resolveAuthenticatedUser(session);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const quota = await checkDailyAiUsageLimit(user.id, 'generate-schedule', 2, user.email || undefined);
    if (!quota.allowed) {
        return NextResponse.json({
            error: "Daily AI limit reached",
            details: "You can use AI 2 times per 24 hours. Try again after the timer resets.",
            limit: quota.limit,
            usedToday: quota.usedToday,
            remaining: quota.remaining,
            resetAt: quota.resetAt.toISOString(),
        }, { status: 429 });
    }

    return handleScheduleRequest(request, user.id, Date.now());
}
