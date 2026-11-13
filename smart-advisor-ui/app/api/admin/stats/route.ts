import { NextResponse, NextRequest } from 'next/server';
import { getAllStudents, initDB } from '@/lib/database';
import { getAIUsageStats } from '@/lib/ai-logger';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/* ─── Load course catalog from JSON files (server-side) ────────── */

interface CourseEntry { code: string; name: string; ch: number; level?: number }
interface CurriculumRules {
    degree_types: Record<string, { major_keys: string[]; total_credits: number }>;
}

let courseCache: Map<string, CourseEntry> | null = null;

type ProgressRow = { student_id: string; major: string; completed: string };
type RecentActivityRow = {
    type: string;
    student_id: string;
    ip: string;
    userAgent: string;
    vendor?: string;
    model?: string;
    os: string;
    browser: string;
    detail: string;
    time: string;
};

type AdminLogRow = {
    id: number;
    type: string;
    message: string | null;
    details: unknown;
    course_id: number | null;
    event_kind: string | null;
    target_id: string | null;
    created_at: Date | null;
};

async function getCourseMap(): Promise<Map<string, CourseEntry>> {
    if (courseCache) return courseCache;

    const dataDir = path.join(process.cwd(), 'public', 'data');
    const masterFile = path.join(dataDir, 'curriculum.json');
    const map = new Map<string, CourseEntry>();

    try {
        const raw = await fs.readFile(masterFile, 'utf-8');
        const json = JSON.parse(raw);

        const extractCourses = (obj: unknown) => {
            if (!obj || typeof obj !== 'object') return;
            for (const [, val] of Object.entries(obj as Record<string, unknown>)) {
                if (Array.isArray(val)) {
                    for (const item of val) {
                        if (item && typeof item === 'object' && 'code' in item && 'ch' in item) {
                            const course = item as { code: string; name?: string; ch: number; level?: number };
                            map.set(course.code, { code: course.code, name: course.name || course.code, ch: course.ch, level: course.level });
                        }
                    }
                } else if (val && typeof val === 'object') {
                    extractCourses(val);
                }
            }
        };

        extractCourses(json.shared);
        extractCourses(json.majors);
    } catch (e) {
        console.error('Failed to load course map for stats:', e);
    }

    courseCache = map;
    return map;
}

async function loadProgressRows(): Promise<ProgressRow[]> {
    try {
        const rows = await prisma.$queryRaw<ProgressRow[]>`SELECT student_id, major, completed FROM student_progress`;
        return rows;
    } catch {
        return [];
    }
}

async function loadCurriculumRules(): Promise<CurriculumRules> {
    const rulesRaw = await fs.readFile(path.join(process.cwd(), 'public', 'data', 'curriculum_rules.json'), 'utf-8');
    return JSON.parse(rulesRaw) as CurriculumRules;
}

function getMajorTotalCredits(rulesJson: CurriculumRules, majorKey: string) {
    for (const type in rulesJson.degree_types) {
        if (rulesJson.degree_types[type].major_keys.includes(majorKey)) {
            return rulesJson.degree_types[type].total_credits;
        }
    }
    return 135;
}

function parseCompletedCourses(completed: string): (string | { code: string; name?: string })[] {
    try {
        const parsed = JSON.parse(completed);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function buildProgressLookup(
    progressRows: ProgressRow[],
    courseMap: Map<string, CourseEntry>
) {
    const courseCounts: Record<string, number> = {};
    const studentCHMap = new Map<string, number>();
    let totalRealCreditHours = 0;

    for (const row of progressRows) {
        const courses = parseCompletedCourses(row.completed);
        let studentCH = 0;

        for (const entry of courses) {
            if (!entry) continue;
            const rawCode = typeof entry === 'string' ? entry : entry.code;
            const code = rawCode?.trim() || 'UNKNOWN';
            courseCounts[code] = (courseCounts[code] || 0) + 1;
            const catalogEntry = courseMap.get(code);
            studentCH += catalogEntry ? catalogEntry.ch : 3;
        }

        studentCHMap.set(`${row.student_id}||${row.major}`, studentCH);
        totalRealCreditHours += studentCH;
    }

    return { courseCounts, studentCHMap, totalRealCreditHours };
}

function summarizeStudents(
    students: { student_id: string; major: string; count: number }[],
    studentCHMap: Map<string, number>,
    rulesJson: CurriculumRules
) {
    const majorCounts: Record<string, number> = {};
    const progressDistribution: Record<string, number> = {
        '0-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-100%': 0,
    };
    const studentRealCH: { student_id: string; major: string; count: number; ch: number }[] = [];

    let totalCompletedCourses = 0;
    let totalWeightedProgress = 0;

    for (const student of students) {
        const major = student.major || 'Unknown';
        majorCounts[major] = (majorCounts[major] || 0) + 1;
        totalCompletedCourses += student.count;

        const realCH = studentCHMap.get(`${student.student_id}||${student.major}`) ?? student.count * 3;
        studentRealCH.push({ ...student, ch: realCH });

        const majorTotalCredits = getMajorTotalCredits(rulesJson, student.major);
        const percent = Math.min((realCH / majorTotalCredits) * 100, 100);
        totalWeightedProgress += percent;

        if (percent <= 25) progressDistribution['0-25%']++;
        else if (percent <= 50) progressDistribution['26-50%']++;
        else if (percent <= 75) progressDistribution['51-75%']++;
        else progressDistribution['76-100%']++;
    }

    return { majorCounts, progressDistribution, totalCompletedCourses, totalWeightedProgress, studentRealCH };
}

function buildTopCourses(courseCounts: Record<string, number>, courseMap: Map<string, CourseEntry>) {
    return Object.entries(courseCounts)
        .map(([code, count]) => {
            const catalogEntry = courseMap.get(code);
            return {
                code,
                name: catalogEntry?.name || code,
                count,
                ch: catalogEntry?.ch ?? 3,
            };
        })
        .sort((a, b) => b.count - a.count);
}

function buildAcademicStats(
    students: { student_id: string; major: string; count: number }[],
    courseMap: Map<string, CourseEntry>,
    progressRows: ProgressRow[],
    rulesJson: CurriculumRules
) {
    const { courseCounts, studentCHMap, totalRealCreditHours } = buildProgressLookup(progressRows, courseMap);
    const { majorCounts, progressDistribution, totalCompletedCourses, totalWeightedProgress, studentRealCH } = summarizeStudents(students, studentCHMap, rulesJson);
    const totalStudents = students.length;

    return {
        totalStudents,
        majorCounts,
        progressDistribution,
        totalCompletedCourses,
        avgCoursesCompleted: totalStudents > 0 ? Math.round(totalCompletedCourses / totalStudents) : 0,
        avgCreditHours: totalStudents > 0 ? Math.round(totalRealCreditHours / totalStudents) : 0,
        avgWeightedProgress: totalStudents > 0 ? Math.round(totalWeightedProgress / totalStudents) : 0,
        topCourses: buildTopCourses(courseCounts, courseMap),
        studentRealCH,
    };
}

async function loadTrafficByDay() {
    try {
        const rows = await prisma.$queryRaw<{ day: Date; count: bigint }[]>`
            SELECT DATE(visited_at) as day, COUNT(*) as count
            FROM visitor_logs
            WHERE visited_at >= NOW() - INTERVAL '30 days'
            GROUP BY DATE(visited_at)
            ORDER BY day ASC
        `;
        return rows.map(r => ({
            date: String(r.day).slice(0, 10),
            count: Number(r.count),
        }));
    } catch {
        return [];
    }
}

async function loadDeviceBreakdown() {
    try {
        const rows = await prisma.$queryRaw<{ os: string; browser: string; count: bigint }[]>`
            SELECT
                COALESCE(os_name, 'Unknown') as os,
                COALESCE(browser_name, 'Unknown') as browser,
                COUNT(*) as count
            FROM visitor_logs
            GROUP BY os_name, browser_name
            ORDER BY count DESC
        `;
        const deviceBreakdown = rows.map(r => ({
            os: String(r.os),
            browser: String(r.browser),
            count: Number(r.count),
        }));

        const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) as total FROM visitor_logs`;
        const totalVisitors = Number(totalRows[0]?.total ?? 0);

        return { deviceBreakdown, totalVisitors };
    } catch {
        return { deviceBreakdown: [], totalVisitors: 0 };
    }
}

async function loadRecentActivity() {
    try {
        const visitRows = await prisma.$queryRaw<{ student_id: string | null; ip_address: string | null; user_agent: string | null; device_vendor: string | null; device_model: string | null; os_name: string | null; os_version: string | null; browser_name: string | null; visited_at: Date }[]>`
            SELECT student_id, ip_address, user_agent, device_vendor, device_model, os_name, os_version, browser_name, visited_at
            FROM visitor_logs
            ORDER BY visited_at DESC
            LIMIT 50
        `;

        const recentActivity: RecentActivityRow[] = [];
        for (const row of visitRows) {
            recentActivity.push({
                type: 'visit',
                student_id: row.student_id || 'Anonymous',
                ip: row.ip_address || 'Unknown',
                userAgent: row.user_agent || 'Unknown',
                vendor: row.device_vendor,
                model: row.device_model,
                os: `${row.os_name || 'Unknown'} ${row.os_version || ''}`.trim(),
                browser: row.browser_name || 'Unknown',
                detail: `Visited from ${row.device_model || row.os_name || 'Unknown'}`,
                time: String(row.visited_at),
            });
        }

        return recentActivity.toSorted((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 50);
    } catch {
        return [];
    }
}

async function loadHeatmap() {
    try {
        const rows = await prisma.$queryRaw<{ day: number; hour: number; count: bigint }[]>`
            SELECT
                EXTRACT(DOW FROM visited_at)::int as day,
                EXTRACT(HOUR FROM visited_at)::int as hour,
                COUNT(*) as count
            FROM visitor_logs
            GROUP BY day, hour
            ORDER BY day, hour
        `;
        return rows.map(r => ({
            day: Number(r.day),
            hour: Number(r.hour),
            count: Number(r.count),
        }));
    } catch {
        return [];
    }
}

async function loadWeekComparison() {
    try {
        const tw = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM visitor_logs
            WHERE visited_at >= DATE_TRUNC('week', NOW())
        `;

        const lw = await prisma.$queryRaw<{ count: bigint }[]>`
            SELECT COUNT(*) as count FROM visitor_logs
            WHERE visited_at >= DATE_TRUNC('week', NOW()) - INTERVAL '7 days'
            AND visited_at < DATE_TRUNC('week', NOW())
        `;

        return {
            thisWeekVisits: Number(tw[0]?.count ?? 0),
            lastWeekVisits: Number(lw[0]?.count ?? 0),
        };
    } catch {
        return { thisWeekVisits: 0, lastWeekVisits: 0 };
    }
}

async function loadAcademicAverages() {
    try {
        const latestGpas = await prisma.gPAHistory.findMany({
            distinct: ['user_id'],
            orderBy: { created_at: 'desc' },
            select: { cumulative_gpa: true },
        });

        let avgCgpa = 0;
        if (latestGpas.length > 0) {
            const totalGpa = latestGpas.reduce((sum, item) => sum + item.cumulative_gpa, 0);
            avgCgpa = Number((totalGpa / latestGpas.length).toFixed(2));
        }

        const sessions = await prisma.studySession.groupBy({
            by: ['user_id'],
            _sum: { duration_minutes: true },
        });

        let avgStudyHours = 0;
        if (sessions.length > 0) {
            const totalMinutes = sessions.reduce((sum, row) => sum + (row._sum.duration_minutes || 0), 0);
            avgStudyHours = Number((totalMinutes / 60 / sessions.length).toFixed(1));
        }

        return { avgCgpa, avgStudyHours };
    } catch {
        return { avgCgpa: 0, avgStudyHours: 0 };
    }
}

async function loadAdminLogs(): Promise<AdminLogRow[]> {
    try {
        return await prisma.adminLog.findMany({
            orderBy: { created_at: 'desc' },
            take: 50,
        });
    } catch {
        return [];
    }
}

async function loadAiUsage() {
    try {
        const stats = await getAIUsageStats(7);
        return stats ?? {
            totalCalls: 0,
            callsByEndpoint: [],
            callsByModel: [],
            callsByStatus: [],
            totalTokens: { input: 0, output: 0, total: 0 },
            avgResponseTimeMs: 0,
            recentLogs: [],
            userUsage: [],
        };
    } catch {
        return {
            totalCalls: 0,
            callsByEndpoint: [],
            callsByModel: [],
            callsByStatus: [],
            totalTokens: { input: 0, output: 0, total: 0 },
            avgResponseTimeMs: 0,
            recentLogs: [],
            userUsage: [],
        };
    }
}

export async function GET(_request: NextRequest) {
    const adminCheck = await requireAdmin(_request);
    if (adminCheck) return adminCheck;

    try {
        await initDB();
        const [students, courseMap, progressRows, rulesJson, trafficByDay, deviceStats, recentActivity, heatmap, weekComparison, averages, adminLogs, aiUsage] = await Promise.all([
            getAllStudents(),
            getCourseMap(),
            loadProgressRows(),
            loadCurriculumRules(),
            loadTrafficByDay(),
            loadDeviceBreakdown(),
            loadRecentActivity(),
            loadHeatmap(),
            loadWeekComparison(),
            loadAcademicAverages(),
            loadAdminLogs(),
            loadAiUsage(),
        ]);

        const academic = buildAcademicStats(students, courseMap, progressRows, rulesJson);

        return NextResponse.json({
            totalStudents: academic.totalStudents,
            totalVisitors: deviceStats.totalVisitors,
            totalCompletedCourses: academic.totalCompletedCourses,
            avgCoursesCompleted: academic.avgCoursesCompleted,
            avgCreditHours: academic.avgCreditHours,
            avgWeightedProgress: academic.avgWeightedProgress,
            avgCgpa: averages.avgCgpa,
            avgStudyHours: averages.avgStudyHours,
            thisWeekVisits: weekComparison.thisWeekVisits,
            lastWeekVisits: weekComparison.lastWeekVisits,
            majorCounts: academic.majorCounts,
            progressDistribution: academic.progressDistribution,
            topCourses: academic.topCourses,
            trafficByDay,
            deviceBreakdown: deviceStats.deviceBreakdown,
            recentActivity,
            heatmap,
            students: academic.studentRealCH,
            studentData: academic.studentRealCH,
            adminLogs,
            aiUsage,
        }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
    } catch (e) {
        console.error('Stats API Error:', e);
        return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500, headers: { 'Cache-Control': 'no-store, max-age=0' } });
    }
}
