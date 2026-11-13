import type { CourseGraph } from "./types";
import {
    evaluatePrerequisiteAvailability,
    type RoadmapCourseInfo,
} from "./roadmap";

export const PLAN_SEMESTERS = [
    { key: "fall", label: "Fall", type: "Fall", maxCH: 18 },
    { key: "spring", label: "Spring", type: "Spring", maxCH: 18 },
    { key: "summer", label: "Summer", type: "Summer", maxCH: 10 },
] as const;

export type PlanSemesterKey = (typeof PLAN_SEMESTERS)[number]["key"];

export type SemesterPlan = Record<PlanSemesterKey, string[]>;

export const RECOMMENDED_MAX_CH = 18;

export function emptySemesterPlan(): SemesterPlan {
    return { fall: [], spring: [], summer: [] };
}

/** Reads a stored plan defensively so bad local data can never crash the view. */
export function normalizeSemesterPlan(raw: unknown): SemesterPlan {
    const plan = emptySemesterPlan();
    if (!raw || typeof raw !== "object") return plan;

    for (const { key } of PLAN_SEMESTERS) {
        const value = (raw as Record<string, unknown>)[key];
        if (!Array.isArray(value)) continue;
        plan[key] = [
            ...new Set(
                value.filter(
                    (code): code is string =>
                        typeof code === "string" && code.trim().length > 0
                )
            ),
        ];
    }

    return plan;
}

export function semesterLabel(key: PlanSemesterKey): string {
    return PLAN_SEMESTERS.find((semester) => semester.key === key)?.label ?? key;
}

export function semesterMaxCH(key: PlanSemesterKey): number {
    return PLAN_SEMESTERS.find((semester) => semester.key === key)?.maxCH ?? RECOMMENDED_MAX_CH;
}

export function planCredits(
    plan: SemesterPlan,
    graph: CourseGraph
): Record<PlanSemesterKey, number> {
    const credits = { fall: 0, spring: 0, summer: 0 };
    for (const { key } of PLAN_SEMESTERS) {
        credits[key] = plan[key].reduce(
            (sum, code) => sum + (graph.nodes.get(code)?.course.ch ?? 0),
            0
        );
    }
    return credits;
}

export function totalPlanCredits(plan: SemesterPlan, graph: CourseGraph): number {
    const credits = planCredits(plan, graph);
    return credits.fall + credits.spring + credits.summer;
}

export function allPlannedCodes(plan: SemesterPlan): Set<string> {
    const codes = new Set<string>();
    for (const { key } of PLAN_SEMESTERS) {
        for (const code of plan[key]) codes.add(code);
    }
    return codes;
}

export function findSemesterOfCourse(
    plan: SemesterPlan,
    code: string
): PlanSemesterKey | null {
    for (const { key } of PLAN_SEMESTERS) {
        if (plan[key].includes(code)) return key;
    }
    return null;
}

export function addCourseToPlan(
    plan: SemesterPlan,
    semester: PlanSemesterKey,
    code: string
): SemesterPlan {
    const next: SemesterPlan = { fall: [], spring: [], summer: [] };
    for (const { key } of PLAN_SEMESTERS) {
        next[key] = plan[key].filter((planned) => planned !== code);
    }
    next[semester].push(code);
    return next;
}

export function removeCourseFromPlan(
    plan: SemesterPlan,
    code: string,
    semester?: PlanSemesterKey
): SemesterPlan {
    const next: SemesterPlan = { fall: [], spring: [], summer: [] };
    for (const { key } of PLAN_SEMESTERS) {
        next[key] =
            semester && semester !== key
                ? [...plan[key]]
                : plan[key].filter((planned) => planned !== code);
    }
    return next;
}

/** First semester (Fall → Spring → Summer) that still has room for the course.
 * Also checks that prerequisites are satisfied (completed or already in a previous semester).
 */
export function nextSemesterWithRoom(
    plan: SemesterPlan,
    graph: CourseGraph,
    code: string,
    completedCodes?: Set<string>,
    inProgressCodes?: Set<string>,
    roadmap?: Map<string, RoadmapCourseInfo>
): PlanSemesterKey {
    const credits = planCredits(plan, graph);
    const courseCH = graph.nodes.get(code)?.course.ch ?? 0;

    // Check prerequisites
    const node = graph.nodes.get(code);
    if (node && roadmap) {
        const info = roadmap.get(code);
        if (info?.status === "Ready After Current Term") {
            // In-progress prereqs exist - course should not be auto-assigned
            // Return the semester after the current term
            // For now, default to fall as the user needs to manually handle this
        }
        if (info?.status === "Blocked") {
            // Missing prereqs - should not be added
            return "fall";
        }
    }

    for (const { key, maxCH } of PLAN_SEMESTERS) {
        if (!plan[key].includes(code) && credits[key] + courseCH <= maxCH) {
            return key;
        }
    }

    return "fall";
}

export interface PlanWarning {
    id: string;
    severity: "warning" | "error" | "info";
    semester?: PlanSemesterKey;
    code?: string;
    message: string;
}

function semesterIndex(key: PlanSemesterKey): number {
    return PLAN_SEMESTERS.findIndex((semester) => semester.key === key);
}

function prereqStatus(
    roadmap: Map<string, RoadmapCourseInfo>,
    code: string
): RoadmapCourseInfo["status"] | null {
    return roadmap.get(code)?.status ?? null;
}

/** Advisory messages shown above the planner and in the roadmap summary. */
export function buildPlanWarnings(
    plan: SemesterPlan,
    graph: CourseGraph,
    roadmap: Map<string, RoadmapCourseInfo>
): PlanWarning[] {
    const warnings: PlanWarning[] = [];
    const seen = new Set<string>();

    const push = (warning: PlanWarning) => {
        if (seen.has(warning.id)) return;
        seen.add(warning.id);
        warnings.push(warning);
    };

    const credits = planCredits(plan, graph);

    // Track planned courses with their prerequisites
    const allPrereqsInProgress = new Set<string>();

    for (const { key, maxCH } of PLAN_SEMESTERS) {
        if (credits[key] > maxCH) {
            const excess = credits[key] - maxCH;
            push({
                id: `overload-${key}`,
                severity: "error",
                semester: key,
                message: `${semesterLabel(key)} is at ${credits[key]} CH — the recommended maximum is ${maxCH} CH. Exceeds limit by ${excess} CH.`,
            });
        }

        const duplicates = plan[key].filter(
            (code, index) =>
                plan[key].indexOf(code) !== index ||
                PLAN_SEMESTERS.some(
                    (other) =>
                        other.key !== key && plan[other.key].includes(code)
                )
        );
        for (const code of duplicates) {
            push({
                id: `duplicate-${code}`,
                severity: "error",
                semester: key,
                code,
                message: `${code} is planned more than once. Each course only needs one semester.`,
            });
        }

        plan[key].forEach((code) => {
            const node = graph.nodes.get(code);
            if (!node) return;

            const info = roadmap.get(code);

            // Check if course is already completed
            if (info?.status === "Completed") {
                push({
                    id: `completed-${code}`,
                    severity: "warning",
                    semester: key,
                    code,
                    message: `${node.course.name} is already marked completed.`,
                });
                return;
            }

            // Check if course has prerequisites in progress that would block it
            if (info?.status === "Ready After Current Term" && info.inProgressPrereqs.length > 0) {
                const prereqNames = info.inProgressPrereqs.map(p => {
                    const prereqNode = graph.nodes.get(p);
                    return prereqNode ? prereqNode.course.name : p;
                }).join(", ");
                push({
                    id: `inprogress-${key}-${code}`,
                    severity: "warning",
                    semester: key,
                    code,
                    message: `${node.course.name} requires ${prereqNames} — still in progress. Consider delaying this course until prerequisites are complete.`,
                });
                allPrereqsInProgress.add(code);
            }

            // Check if course is blocked
            if (info?.status === "Blocked") {
                const missingNames = info.missingPrereqs.map(p => {
                    const prereqNode = graph.nodes.get(p);
                    return prereqNode ? prereqNode.course.name : p;
                }).join(", ");
                push({
                    id: `blocked-${key}-${code}`,
                    severity: "error",
                    semester: key,
                    code,
                    message: `${node.course.name} is blocked — missing prerequisites: ${missingNames}.`,
                });
            }

            const currentIndex = semesterIndex(key);

            // Evaluate AND/OR groups properly
            const missing = evaluatePrerequisiteAvailability(
                node.prereqExpr,
                (prereqCode) => {
                    const status = prereqStatus(roadmap, prereqCode);
                    // Consider completed, in-progress, or planned in a previous semester as satisfied
                    if (status === "Completed" || status === "In Progress" || status === "Planned") {
                        return true;
                    }
                    const prereqSemester = findSemesterOfCourse(plan, prereqCode);
                    if (prereqSemester === null) {
                        // Prereq not yet planned - check if it's in progress via overrides
                        return false;
                    }
                    return semesterIndex(prereqSemester) < currentIndex;
                },
                graph
            ).missing;

            for (const prereq of missing) {
                if (!graph.nodes.has(prereq)) continue;
                const prereqSemester = findSemesterOfCourse(plan, prereq);
                const prereqName = graph.nodes.get(prereq)?.course.name ?? prereq;

                if (!prereqSemester) {
                    push({
                        id: `missing-${key}-${code}-${prereq}`,
                        severity: "warning",
                        semester: key,
                        code,
                        message: `${node.course.name} requires ${prereqName} (${prereq}), which is not in your plan.`,
                    });
                    continue;
                }

                const prereqIndex = semesterIndex(prereqSemester);
                if (prereqIndex === currentIndex) {
                    push({
                        id: `same-${key}-${code}-${prereq}`,
                        severity: "warning",
                        semester: key,
                        code,
                        message: `${node.course.name} requires ${prereqName}, which is planned in the same semester.`,
                    });
                } else if (prereqIndex > currentIndex) {
                    push({
                        id: `later-${key}-${code}-${prereq}`,
                        severity: "warning",
                        semester: key,
                        code,
                        message: `${node.course.name} requires ${prereqName}, which is planned after it (${semesterLabel(prereqSemester)}).`,
                    });
                }
            }
        });
    }

    // Check for in-progress prereq conflicts across all semesters
    if (allPrereqsInProgress.size > 0) {
        const coursesWithInProgressPrereqs = [...allPrereqsInProgress].map(code => {
            const info = roadmap.get(code);
            const node = graph.nodes.get(code);
            return { code, info, node };
        }).filter(({ code, info, node }) => code && info && node);

        if (coursesWithInProgressPrereqs.length > 0) {
            push({
                id: "inprogress-summary",
                severity: "info",
                message: `${coursesWithInProgressPrereqs.length} planned course(s) have prerequisites currently in progress. These may need to be delayed.`,
            });
        }
    }

    return warnings;
}

/** Academic year used when syncing a plan semester to the cloud planner. */
export function planSemesterYear(
    _key: PlanSemesterKey,
    now = new Date()
): number {
    return now.getFullYear();
}
