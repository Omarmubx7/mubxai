import type { Course, CourseData, CurriculumRules } from "@/types";
import { isTrackerVisibleCourse } from "@/lib/constants";
import {
    collectPrereqGates,
    collectPrereqRefs,
    parsePrerequisite,
} from "./prereq-parser";
import {
    CATEGORY_ORDER,
    type CourseCategory,
    type CourseGraph,
    type CourseGraphEdge,
    type CourseTreeEntry,
    type CourseTreeNode,
    type PrereqGateExpr,
} from "./types";

const CATEGORY_ENTRIES: Array<[keyof CourseData, CourseCategory]> = [
    ["university_requirements", "University Requirements"],
    ["university_electives", "University Elective"],
    ["college_requirements", "College Requirements"],
    ["department_requirements", "Department Requirements"],
    ["electives", "Department Elective"],
    ["work_market_requirements", "Department Requirements"],
];

/** Flatten a major's course data into de-duplicated entries with categories. */
export function collectCourseEntries(data: CourseData): CourseTreeEntry[] {
    const map = new Map<string, CourseTreeEntry>();
    let order = 0;

    const push = (course: Course | undefined, category: CourseCategory) => {
        if (!course?.code || !isTrackerVisibleCourse(course)) return;
        const existing = map.get(course.code);
        if (existing) {
            if (!existing.categories.includes(category)) {
                existing.categories.push(category);
            }
            return;
        }
        map.set(course.code, {
            course,
            categories: [category],
            order,
        });
        order += 1;
    };

    for (const [key, category] of CATEGORY_ENTRIES) {
        const list = data[key];
        if (!Array.isArray(list)) continue;
        for (const course of list) push(course, category);
    }

    return [...map.values()];
}

function categoryRank(categories: CourseCategory[]): number {
    let best = CATEGORY_ORDER.length;
    for (const category of categories) {
        const index = CATEGORY_ORDER.indexOf(category);
        if (index >= 0 && index < best) best = index;
    }
    return best;
}

function computeDepth(
    nodes: Map<string, CourseTreeNode>
): { depths: Map<string, number>; cycles: string[][] } {
    const depths = new Map<string, number>();
    const cycles: string[][] = [];
    const seenCycles = new Set<string>();
    const visiting = new Set<string>();

    const visit = (code: string, stack: string[]): number => {
        const cached = depths.get(code);
        if (cached !== undefined) return cached;
        if (visiting.has(code)) {
            const cycle = [...stack, code];
            const key = [...cycle].sort().join("|");
            if (!seenCycles.has(key)) {
                seenCycles.add(key);
                cycles.push(cycle);
            }
            return 0;
        }

        const node = nodes.get(code);
        if (!node) return 0;

        visiting.add(code);
        let depth = 0;
        for (const parent of node.prereqCodes) {
            if (!nodes.has(parent)) continue;
            depth = Math.max(depth, visit(parent, [...stack, code]) + 1);
        }
        visiting.delete(code);
        depths.set(code, depth);
        return depth;
    };

    for (const code of nodes.keys()) visit(code, []);
    return { depths, cycles };
}

/**
 * Build the prerequisite graph for one major.
 *
 * Prerequisites form a DAG rather than a strict tree: a course can have more
 * than one parent. We keep one node per course and store the edges separately,
 * then let the layout render it as a layered tree.
 */
export function buildCourseGraph(
    data: CourseData,
    rules?: CurriculumRules
): CourseGraph {
    const entries = collectCourseEntries(data);
    const nodes = new Map<string, CourseTreeNode>();

    for (const entry of entries) {
        const prereqExpr = parsePrerequisite(
            entry.course.prereq,
            rules?.logic_rules?.prerequisites
        );

        const prereqCodes: string[] = [];
        const orByCode = new Map<string, boolean>();
        for (const ref of collectPrereqRefs(prereqExpr)) {
            if (!orByCode.has(ref.code)) {
                prereqCodes.push(ref.code);
                orByCode.set(ref.code, ref.or);
            } else if (!ref.or) {
                orByCode.set(ref.code, false);
            }
        }

        const gates: PrereqGateExpr[] = collectPrereqGates(prereqExpr);

        nodes.set(entry.course.code, {
            ...entry,
            code: entry.course.code,
            prereqExpr,
            prereqCodes,
            externalPrereqCodes: [],
            gates,
            dependents: [],
        });
    }

    const edges: CourseGraphEdge[] = [];
    const edgeKeys = new Set<string>();
    const externalCodes = new Set<string>();

    for (const node of nodes.values()) {
        for (const code of node.prereqCodes) {
            if (!nodes.has(code)) {
                node.externalPrereqCodes.push(code);
                externalCodes.add(code);
                continue;
            }

            const key = `${code}->${node.code}`;
            const isOr = node.prereqExpr
                ? collectPrereqRefs(node.prereqExpr).some(
                    (ref) => ref.code === code && ref.or
                )
                : false;

            if (edgeKeys.has(key)) {
                const existing = edges.find(
                    (edge) => edge.from === code && edge.to === node.code
                );
                if (existing && isOr) existing.or = true;
                continue;
            }

            edgeKeys.add(key);
            edges.push({ from: code, to: node.code, or: isOr });
            const parent = nodes.get(code);
            if (parent && !parent.dependents.includes(node.code)) {
                parent.dependents.push(node.code);
            }
        }
        node.externalPrereqCodes.sort();
    }

    const { depths, cycles } = computeDepth(nodes);

    const order = [...nodes.keys()].sort((a, b) => {
        const nodeA = nodes.get(a);
        const nodeB = nodes.get(b);
        if (!nodeA || !nodeB) return a.localeCompare(b);

        const levelA = nodeA.course.level ?? 1;
        const levelB = nodeB.course.level ?? 1;
        if (levelA !== levelB) return levelA - levelB;

        const catA = categoryRank(nodeA.categories);
        const catB = categoryRank(nodeB.categories);
        if (catA !== catB) return catA - catB;

        if (nodeA.order !== nodeB.order) return nodeA.order - nodeB.order;
        return a.localeCompare(b);
    });

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
        depths,
        cycles,
        externalCodes: [...externalCodes].sort(),
    };
}

/** Courses that directly unlock a given course. */
export function getDirectDependents(graph: CourseGraph, code: string): string[] {
    return graph.nodes.get(code)?.dependents ?? [];
}

/** Every prerequisite of a course, including transitive parents. */
export function getAncestors(graph: CourseGraph, code: string): Set<string> {
    const result = new Set<string>();
    const queue = [...(graph.nodes.get(code)?.prereqCodes ?? [])];
    while (queue.length > 0) {
        const next = queue.shift() as string;
        if (result.has(next) || !graph.nodes.has(next)) continue;
        result.add(next);
        queue.push(...(graph.nodes.get(next)?.prereqCodes ?? []));
    }
    return result;
}

/** Every course unlocked by a course, including transitive dependents. */
export function getDescendants(graph: CourseGraph, code: string): Set<string> {
    const result = new Set<string>();
    const queue = [...getDirectDependents(graph, code)];
    while (queue.length > 0) {
        const next = queue.shift() as string;
        if (result.has(next) || !graph.nodes.has(next)) continue;
        result.add(next);
        queue.push(...getDirectDependents(graph, next));
    }
    return result;
}
