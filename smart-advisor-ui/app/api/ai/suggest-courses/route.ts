import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { getSuggestedCourses } from "@/lib/groq";
import { logAIUsage } from "@/lib/ai-logger";
import { checkDailyAiUsageLimit } from "@/lib/ai-usage-limit";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";

type CandidateCourse = {
    code: string;
    name: string;
    credits: number;
    prereq?: string;
};

export async function POST(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await resolveAuthenticatedUser(session);
    if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const quota = await checkDailyAiUsageLimit(user.id, 'suggest-courses', 2, user.email || undefined);
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

    const startTime = Date.now();
    const userId: number | null = user.id;
    let status: 'success' | 'error' | 'timeout' = 'success';
    let errorMessage: string | undefined;

    try {
        const body = await request.json();
        const major = typeof body.major === "string" ? body.major : "";
        const completedCourses = Array.isArray(body.completedCourses)
            ? body.completedCourses.filter((c: unknown): c is string => typeof c === "string")
            : [];
        const candidateCourses = Array.isArray(body.candidateCourses)
            ? body.candidateCourses.filter(
                (c: unknown): c is CandidateCourse =>
                    typeof c === "object" &&
                    c !== null &&
                    typeof (c as CandidateCourse).code === "string" &&
                    typeof (c as CandidateCourse).name === "string" &&
                    typeof (c as CandidateCourse).credits === "number"
            )
            : [];

        if (!major || candidateCourses.length === 0) {
            status = 'error';
            errorMessage = 'Invalid payload';
            await logAIUsage({
                userId,
                endpoint: 'suggest-courses',
                featureName: 'Course Suggestions',
                status,
                errorMessage,
                responseTimeMs: Date.now() - startTime,
            });
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        let parsed: unknown = {};
        try {
            const { content, usage } = await getSuggestedCourses({ major, completedCourses, candidateCourses });

            try {
                parsed = JSON.parse(content);
            } catch {
                parsed = { recommendations: [], tips: [], raw: content };
            }

            await logAIUsage({
                userId,
                endpoint: 'suggest-courses',
                featureName: 'Course Suggestions',
                modelUsed: usage.modelUsed,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                status,
                errorMessage,
                responseTimeMs: Date.now() - startTime,
                metadata: {
                    major,
                    completedCoursesCount: completedCourses.length,
                    candidateCoursesCount: candidateCourses.length,
                },
            });
        } catch (error: unknown) {
            status = 'error';
            errorMessage = error instanceof Error ? error.message : String(error);
            console.error("suggest-courses AI call failed:", errorMessage);

            await logAIUsage({
                userId,
                endpoint: 'suggest-courses',
                featureName: 'Course Suggestions',
                status,
                errorMessage,
                responseTimeMs: Date.now() - startTime,
            });

            return NextResponse.json({
                error: "AI suggestions are temporarily unavailable. Please try again in a few minutes.",
            }, { status: 502 });
        }

        return NextResponse.json({ result: parsed });
    } catch (error: unknown) {
        status = 'error';
        errorMessage = error instanceof Error ? error.message : String(error);
        console.error("suggest-courses error", error);

        // Log the error
        await logAIUsage({
            userId,
            endpoint: 'suggest-courses',
            featureName: 'Course Suggestions',
            status,
            errorMessage,
            responseTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({ 
            error: "Failed to generate suggestions"
        }, { status: 500 });
    }
}
