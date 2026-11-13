import type {
    CourseCategory,
    CourseGraph,
    CourseTreeNode,
    PrereqExpr,
} from "./types";
import { CATEGORY_ORDER } from "./types";

/** Status shown on roadmap cards and in the course drawer. */
export type RoadmapStatus =
    | "Completed"
    | "In Progress"
    | "Ready Now"
    | "Ready After Current Term"
    | "Blocked"
    | "Planned";

export const ROADMAP_STATUS_ORDER: RoadmapStatus[] = [
    "Completed",
    "In Progress",
    "Planned",
    "Ready Now",
    "Ready After Current Term",
    "Blocked",
];

export interface RoadmapCourseInfo {
    code: string;
    node: CourseTreeNode;
    category: CourseCategory;
    status: RoadmapStatus;
    /** Prerequisite course codes that are not completed or in progress. */
    missingPrereqs: string[];
    /** Prerequisites that are in progress (not completed). */
    inProgressPrereqs: string[];
    /** Direct prerequisite course codes from the catalog. */
    prereqCodes: string[];
    /** Direct courses unlocked by this course. */
    unlockCodes: string[];
    prereqSummary: string;
    unlockSummary: string;
    /** Longest prerequisite chain ending at this course. */
    depth: number;
}

const CATEGORY_RANK = new Map<CourseCategory, number>(
    CATEGORY_ORDER.map((category, index) => [category, index])
);

export function primaryCategory(node: CourseTreeNode): CourseCategory {
    let best: CourseCategory = node.categories[0] ?? "Department Requirements";
    let bestRank = CATEGORY_RANK.get(best) ?? CATEGORY_ORDER.length;
    for (const category of node.categories) {
        const rank = CATEGORY_RANK.get(category) ?? CATEGORY_ORDER.length;
        if (rank < bestRank) {
            best = category;
            bestRank = rank;
        }
    }
    return best;
}

function unique(codes: string[]): string[] {
    return [...new Set(codes)];
}

/**
 * Evaluates whether a prerequisite expression is satisfied by completed or
 * in-progress courses. Credit-hour gates, approvals and placement tests are
 * treated as advisory because they are not courses the roadmap can schedule.
 */
export function evaluatePrerequisiteAvailability(
    expr: PrereqExpr | null,
    isSatisfied: (code: string) => boolean,
    graph: CourseGraph
): { available: boolean; missing: string[] } {
    if (!expr) return { available: true, missing: [] };

    if (expr.kind === "course") {
        // Codes that are not part of this major's catalog cannot be verified,
        // so they are treated as satisfied (matching the tracker's behaviour).
        if (!graph.nodes.has(expr.code) || isSatisfied(expr.code)) {
            return { available: true, missing: [] };
        }
        return { available: false, missing: [expr.code] };
    }

    if (expr.kind === "gate") return { available: true, missing: [] };

    const results = expr.children.map((child) =>
        evaluatePrerequisiteAvailability(child, isSatisfied, graph)
    );

    if (expr.kind === "or") {
        if (results.some((result) => result.available)) {
            return { available: true, missing: [] };
        }
        return {
            available: false,
            missing: unique(results.flatMap((result) => result.missing)),
        };
    }

    const missing = unique(
        results
            .filter((result) => !result.available)
            .flatMap((result) => result.missing)
    );
    return { available: missing.length === 0, missing };
}

export interface BuildRoadmapOptions {
    completedCodes: Set<string>;
    inProgressCodes: Set<string>;
    plannedCodes?: Set<string>;
}

/**
 * Builds the per-course roadmap model used by every view.
 *
 * Status determination:
 * - COMPLETED: already passed
 * - IN PROGRESS: currently taking the course
 * - PLANNED: added to future semester plan
 * - READY NOW: all prerequisites completed (no in-progress)
 * - READY AFTER CURRENT TERM: has in-progress prerequisites
 * - BLOCKED: missing prerequisites
 */
export function buildRoadmap(
    graph: CourseGraph,
    options: BuildRoadmapOptions
): Map<string, RoadmapCourseInfo> {
    const { completedCodes, inProgressCodes, plannedCodes = new Set() } = options;

    // Check if a course code exists and is completed
    const isCompleted = (code: string) => completedCodes.has(code);
    // Check if a code is in an in-progress state (not just planned)
    const isInProgressOnly = (code: string) => inProgressCodes.has(code);
    // Check if prerequisites are fully satisfied (completed only, not in-progress)
    const isPrereqCompleted = (code: string) => completedCodes.has(code);
    // Check if prerequisites are satisfied (completed OR in-progress for blocking)
    const isPrereqSatisfied = (code: string) =>
        completedCodes.has(code) || inProgressCodes.has(code);

    const roadmap = new Map<string, RoadmapCourseInfo>();

    for (const code of graph.order) {
        const node = graph.nodes.get(code);
        if (!node) continue;

        // First, evaluate prerequisites with only completed as satisfied
        const { available: fullyAvailable, missing } = evaluatePrerequisiteAvailability(
            node.prereqExpr,
            isPrereqCompleted,
            graph
        );

        // Then evaluate with completed OR in-progress as satisfied
        const { available: partiallyAvailable } = evaluatePrerequisiteAvailability(
            node.prereqExpr,
            isPrereqSatisfied,
            graph
        );

        // Find which prereqs are in progress (not completed)
        const inProgressPrereqs = node.prereqCodes.filter(
            (prereq) => isInProgressOnly(prereq) && !isCompleted(prereq)
        );

        // Determine status with clearer semantics
        let status: RoadmapStatus;
        if (completedCodes.has(code)) {
            status = "Completed";
        } else if (inProgressCodes.has(code)) {
            status = "In Progress";
        } else if (plannedCodes.has(code)) {
            status = "Planned";
        } else if (fullyAvailable) {
            // All prerequisites are completed
            status = "Ready Now";
        } else if (partiallyAvailable) {
            // Some prerequisites are in progress, none missing
            status = "Ready After Current Term";
        } else {
            // Has missing prerequisites
            status = "Blocked";
        }

        const unlockCodes = node.dependents.filter((dependent) =>
            graph.nodes.has(dependent)
        );

        roadmap.set(code, {
            code,
            node,
            category: primaryCategory(node),
            status,
            missingPrereqs: missing,
            inProgressPrereqs,
            prereqCodes: node.prereqCodes,
            unlockCodes,
            prereqSummary: summarizeCodes(node.prereqCodes),
            unlockSummary: summarizeCodes(unlockCodes),
            depth: graph.depths.get(code) ?? 0,
        });
    }

    return roadmap;
}

export function summarizeCodes(codes: string[], max = 3): string {
    if (codes.length === 0) return "";
    const shown = codes.slice(0, max).join(", ");
    return codes.length > max ? `${shown} +${codes.length - max}` : shown;
}

export function readyNow(
    roadmap: Map<string, RoadmapCourseInfo>
): RoadmapCourseInfo[] {
    return [...roadmap.values()]
        .filter((info) => info.status === "Ready Now")
        .sort(
            (a, b) =>
                b.unlockCodes.length - a.unlockCodes.length ||
                (a.node.course.level ?? 1) - (b.node.course.level ?? 1) ||
                a.code.localeCompare(b.code)
        );
}

/** Alias for backward compatibility */
export const availableNow = readyNow;

export function countByStatus(
    roadmap: Map<string, RoadmapCourseInfo>,
    status: RoadmapStatus
): number {
    let count = 0;
    for (const info of roadmap.values()) {
        if (info.status === status) count += 1;
    }
    return count;
}

const CAPSTONE_PATTERN = /capstone|graduation project|final project|project\s*(ii|2)\b/i;

/** Prefer a capstone/final project, otherwise the deepest course in the DAG. */
export function findCriticalTarget(graph: CourseGraph): string | null {
    let best: string | null = null;
    let bestScore = -1;

    for (const [code, node] of graph.nodes) {
        const depth = graph.depths.get(code) ?? 0;
        const capstone = CAPSTONE_PATTERN.test(node.course.name) ? 1000 : 0;
        const score = capstone + depth;
        if (score > bestScore) {
            best = code;
            bestScore = score;
        }
    }

    return best;
}

export interface CriticalPath {
    codes: string[];
    set: Set<string>;
    target: string | null;
    totalCH: number;
}

/**
 * Longest prerequisite chain ending at the chosen target course.
 * The toggle in the full map highlights exactly these courses and links.
 */
export function computeCriticalPath(
    graph: CourseGraph,
    targetCode?: string | null
): CriticalPath {
    const target =
        targetCode && graph.nodes.has(targetCode)
            ? targetCode
            : findCriticalTarget(graph);

    if (!target) {
        return { codes: [], set: new Set(), target: null, totalCH: 0 };
    }

    const chain: string[] = [];
    const seen = new Set<string>();
    let current: string | null = target;

    while (current && !seen.has(current)) {
        seen.add(current);
        chain.unshift(current);

        const node = graph.nodes.get(current);
        const parents = (node?.prereqCodes ?? []).filter((parent) =>
            graph.nodes.has(parent)
        );
        if (parents.length === 0) break;

        current = parents.reduce((best, parent) =>
            (graph.depths.get(parent) ?? 0) > (graph.depths.get(best) ?? 0)
                ? parent
                : best
        );
    }

    const totalCH = chain.reduce(
        (sum, code) => sum + (graph.nodes.get(code)?.course.ch ?? 0),
        0
    );

    return { codes: chain, set: new Set(chain), target, totalCH };
}

export type CreditFilter = "all" | "1-2" | "3" | "4+";

export const CREDIT_FILTER_OPTIONS: Array<{
    value: CreditFilter;
    label: string;
}> = [
    { value: "all", label: "Any credits" },
    { value: "1-2", label: "1–2 CH" },
    { value: "3", label: "3 CH" },
    { value: "4+", label: "4+ CH" },
];

export interface RoadmapFilterState {
    query: string;
    statuses: RoadmapStatus[];
    categories: CourseCategory[];
    levels: number[];
    credit: CreditFilter;
}

export const DEFAULT_ROADMAP_FILTERS: RoadmapFilterState = {
    query: "",
    statuses: [],
    categories: [],
    levels: [],
    credit: "all",
};

function matchesCredit(ch: number, credit: CreditFilter): boolean {
    if (credit === "all") return true;
    if (credit === "1-2") return ch <= 2;
    if (credit === "3") return ch === 3;
    return ch >= 4;
}

export function matchesRoadmapFilters(
    info: RoadmapCourseInfo,
    filters: RoadmapFilterState
): boolean {
    const needle = filters.query.trim().toLowerCase();
    if (needle) {
        const matches =
            info.code.toLowerCase().includes(needle) ||
            info.node.course.name.toLowerCase().includes(needle);
        if (!matches) return false;
    }

    if (filters.statuses.length > 0 && !filters.statuses.includes(info.status)) {
        return false;
    }
    if (
        filters.categories.length > 0 &&
        !filters.categories.includes(info.category)
    ) {
        return false;
    }
    if (filters.levels.length > 0) {
        const level = info.node.course.level ?? 1;
        if (!filters.levels.includes(level)) return false;
    }

    return matchesCredit(info.node.course.ch ?? 0, filters.credit);
}

/**
 * Returns a sub-graph containing only courses that pass the active filters.
 * The prerequisite data itself is untouched; this is a view projection.
 */
export function filterCourseGraph(
    graph: CourseGraph,
    roadmap: Map<string, RoadmapCourseInfo>,
    filters: RoadmapFilterState
): CourseGraph {
    const nodes = new Map<string, CourseTreeNode>();
    for (const code of graph.order) {
        const node = graph.nodes.get(code);
        const info = roadmap.get(code);
        if (!node || !info) continue;
        if (!matchesRoadmapFilters(info, filters)) continue;
        nodes.set(code, node);
    }

    const order = graph.order.filter((code) => nodes.has(code));
    const edges = graph.edges.filter(
        (edge) => nodes.has(edge.from) && nodes.has(edge.to)
    );
    const roots = order.filter((code) => {
        const node = nodes.get(code);
        if (!node) return false;
        return !node.prereqCodes.some((parent) => nodes.has(parent));
    });

    return {
        nodes,
        order,
        edges,
        roots,
        depths: graph.depths,
        cycles: graph.cycles,
        externalCodes: graph.externalCodes,
    };
}
