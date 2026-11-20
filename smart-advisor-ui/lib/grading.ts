// HTU Al Hussein Technical University — Grading System

export type HTUGrade = "D" | "M" | "P" | "U" | "WF" | "TC" | "X";

export interface GradeInfo {
    label: string;
    points: number;
    colorKey: string;
}

export const GRADE_MAP: Record<string, GradeInfo> = {
    D: { label: "Distinction", points: 4, colorKey: "emerald" },
    M: { label: "Merit", points: 3.2, colorKey: "blue" },
    P: { label: "Pass", points: 2.4, colorKey: "amber" },
    U: { label: "Unclassified", points: 0, colorKey: "red" },
    WF: { label: "Withdrawal with Failure", points: 0, colorKey: "red" },
    TC: { label: "Transfer Credits", points: 0, colorKey: "gray" },
    X: { label: "Course not Included in the Study Plan", points: 0, colorKey: "gray" },
};

export const SCORED_GRADES: HTUGrade[] = ["D", "M", "P", "U"];
export const MIN_PASS_POINTS = 2.4;

export const CUMULATIVE_CLASSIFICATIONS = [
    { min: 3.6, max: 4, label: "Excellent (EX)", short: "EX", colorKey: "emerald", motivation: "Elite status! You're crushing it." },
    { min: 3.2, max: 3.59, label: "Very Good (VG)", short: "VG", colorKey: "blue", motivation: "Outstanding! Keep pushing for Distinction." },
    { min: 2.8, max: 3.19, label: "Good", short: "Good", colorKey: "violet", motivation: "Solid performance. You're doing great!" },
    { min: 2.4, max: 2.79, label: "Satisfactory", short: "SAT", colorKey: "amber", motivation: "On the right track. Every credit counts!" },
    { min: 0, max: 2.39, label: "Below Minimum", short: "LOW", colorKey: "red", motivation: "Keep your head up. Focus on the next goal." },
];

// ── GPA Logic ──────────────────────────────────────────

export function gradeToPoints(grade: string): number {
    return GRADE_MAP[grade]?.points ?? 0;
}

/**
 * Semester GPA logic (as requested)
 */
export function calculateSemesterGpa(courses: { grade: string; credits: number }[]): number {
    let totalQualityPoints = 0;
    let totalCredits = 0;

    const scored = courses.filter(c => SCORED_GRADES.includes(c.grade as HTUGrade));

    for (const course of scored) {
        const points = gradeToPoints(course.grade);
        totalQualityPoints += points * course.credits;
        totalCredits += course.credits;
    }

    if (totalCredits === 0) return 0;
    const gpa = totalQualityPoints / totalCredits;
    return Math.round(gpa * 100) / 100; // Rounding to 2 decimal places
}

/**
 * Calculate CGPA from current course map and optional historical baseline.
 * This is the central source of truth for the dashboard.
 */
export function calculateCGPA(
    completedCourses: Map<string, string> | Set<string>,
    allCourses: { code: string; ch: number }[],
    history?: { gpa: number | null; credits: number | null }
): number {
    let totalQualityPoints = 0;
    let totalCredits = 0;

    // 1. Calculate from current tracking
    const courseEntries = completedCourses instanceof Map 
        ? Array.from(completedCourses.entries()) 
        : Array.from(completedCourses).map(code => [code, "M"] as [string, string]);

    for (const [code, grade] of courseEntries) {
        const course = allCourses.find(c => c.code === code);
        if (course && course.ch > 0 && SCORED_GRADES.includes(grade as HTUGrade)) {
            totalQualityPoints += gradeToPoints(grade) * course.ch;
            totalCredits += course.ch;
        }
    }

    // 2. Add historical baseline
    if (history?.gpa != null && history?.credits != null) {
        totalQualityPoints += (history.gpa * history.credits);
        totalCredits += history.credits;
    }

    if (totalCredits === 0) return 0;
    const gpa = totalQualityPoints / totalCredits;
    return Math.round(gpa * 100) / 100;
}

/**
 * Compatibility wrapper for existing dashboard logic
 */
export function calculateGPA(courses: { credits: number; grade: string }[]): number {
    return calculateSemesterGpa(courses);
}

export function getClassification(gpa: number) {
    for (const c of CUMULATIVE_CLASSIFICATIONS) {
        if (gpa >= c.min && gpa <= c.max) return c;
    }
    return CUMULATIVE_CLASSIFICATIONS.at(-1)!;
}

// The curriculum object is imported once per isolate; avoid rebuilding the
// same ~hundreds-of-entries map on every summary/grading request.
const creditMapCache = new WeakMap<object, Map<string, number>>();

/**
 * Builds a map of course codes to their credit hours (CH) from the curriculum JSON.
 */
export function buildCourseCreditMap(curriculum: unknown): Map<string, number> {
    if (curriculum && typeof curriculum === "object") {
        const cached = creditMapCache.get(curriculum);
        if (cached) return cached;
    }

    const map = new Map<string, number>();
    const addCourseList = (courses: unknown) => {
        if (!Array.isArray(courses)) return;
        for (const course of courses as Array<Record<string, unknown>>) {
            const code = typeof course.code === 'string' ? course.code : null;
            if (!code) continue;
            let credits = 3;
            if (typeof course.ch === 'number') credits = course.ch;
            else if (typeof course.credits === 'number') credits = course.credits;
            map.set(code, credits);
        }
    };

    if (!curriculum || typeof curriculum !== 'object') return map;

    const root = curriculum as Record<string, unknown>;
    const shared = root.shared as Record<string, unknown> | undefined;
    const majors = root.majors as Record<string, unknown> | undefined;

    if (shared && typeof shared === 'object') {
        for (const list of Object.values(shared)) addCourseList(list);
    }

    if (majors && typeof majors === 'object') {
        for (const majorValue of Object.values(majors)) {
            if (!majorValue || typeof majorValue !== 'object') continue;
            for (const list of Object.values(majorValue as Record<string, unknown>)) {
                addCourseList(list);
            }
        }
    }

    if (curriculum && typeof curriculum === "object") {
        creditMapCache.set(curriculum, map);
    }
    return map;
}

/**
 * Extracts a course code from a progress entry (which might be a string or an object).
 */
export function getCompletedEntryCode(entry: unknown): string | null {
    if (typeof entry === 'string') return entry;
    if (!entry || typeof entry !== 'object') return null;
    const e = entry as Record<string, unknown>;
    if (typeof e.code === 'string') return e.code;
    return null;
}
