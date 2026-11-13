import { describe, expect, it } from "vitest";
import type { Course, CourseData } from "@/types";
import { buildCourseGraph } from "@/lib/course-tree/course-graph";
import {
    buildRoadmap,
    computeCriticalPath,
    filterCourseGraph,
    DEFAULT_ROADMAP_FILTERS,
} from "@/lib/course-tree/roadmap";
import { buildExplorerFlow } from "@/lib/course-tree/explorer-layout";
import {
    addCourseToPlan,
    buildPlanWarnings,
    emptySemesterPlan,
    normalizeSemesterPlan,
    planCredits,
    removeCourseFromPlan,
} from "@/lib/course-tree/semester-plan";

const A = "10000001";
const B = "10000002";
const C = "10000003";
const D = "10000004";
const E = "10000005";

function course(
    code: string,
    name: string,
    ch: number,
    level: 1 | 2 | 3 | 4 | 5,
    prereq?: string
): Course {
    return {
        code,
        name,
        ch,
        framework: "HTU",
        level,
        ...(prereq ? { prereq } : {}),
    };
}

function mockData(): CourseData {
    return {
        university_requirements: [course(A, "Alpha", 3, 1)],
        college_requirements: [course(B, "Beta", 3, 2, A)],
        department_requirements: [
            course(C, "Capstone I", 3, 3, B),
            course(D, "Delta", 4, 1, `${A} OR ${E}`),
            course(E, "Epsilon", 2, 1),
        ],
        electives: [],
        university_electives: [],
    };
}

const EMPTY = new Set<string>();

describe("roadmap availability", () => {
    it("marks courses available only when their prerequisites are satisfied", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        expect(roadmap.get(A)?.status).toBe("Ready Now");
        expect(roadmap.get(B)?.status).toBe("Blocked");
        expect(roadmap.get(B)?.missingPrereqs).toEqual([A]);
        expect(roadmap.get(C)?.status).toBe("Blocked");
        expect(roadmap.get(A)?.unlockCodes).toContain(B);
    });

    it("counts in-progress prerequisites as satisfied", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: new Set([A]),
        });

        expect(roadmap.get(A)?.status).toBe("In Progress");
        expect(roadmap.get(B)?.status).toBe("Ready After Current Term");
        expect(roadmap.get(B)?.inProgressPrereqs).toEqual([A]);
        expect(roadmap.get(C)?.status).toBe("Blocked");
    });

    it("handles OR prerequisite groups", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: new Set([E]),
            inProgressCodes: EMPTY,
        });

        expect(roadmap.get(D)?.status).toBe("Ready Now");
        expect(roadmap.get(D)?.missingPrereqs).toEqual([]);
    });

    it("keeps completed courses completed even when a prerequisite is missing", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: new Set([B]),
            inProgressCodes: EMPTY,
        });

        expect(roadmap.get(B)?.status).toBe("Completed");
        expect(roadmap.get(C)?.status).toBe("Ready Now");
    });
});

describe("critical path", () => {
    it("follows the longest prerequisite chain to its deepest course", () => {
        const graph = buildCourseGraph(mockData());
        const critical = computeCriticalPath(graph);

        expect(critical.target).toBe(C);
        expect(critical.codes).toEqual([A, B, C]);
        expect(critical.totalCH).toBe(9);
        expect(critical.set.has(B)).toBe(true);
    });

    it("accepts an explicit target", () => {
        const graph = buildCourseGraph(mockData());
        const critical = computeCriticalPath(graph, B);

        expect(critical.target).toBe(B);
        expect(critical.codes).toEqual([A, B]);
    });
});

describe("curriculum filters", () => {
    it("projects the graph down to matching roadmap statuses", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        const filtered = filterCourseGraph(graph, roadmap, {
            ...DEFAULT_ROADMAP_FILTERS,
            statuses: ["Ready Now"],
        });

        expect([...filtered.nodes.keys()].sort()).toEqual([A, E].sort());
        expect(filtered.edges).toHaveLength(0);
    });

    it("filters by credit hours and query without losing prerequisites data", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        const filtered = filterCourseGraph(graph, roadmap, {
            ...DEFAULT_ROADMAP_FILTERS,
            credit: "4+",
            query: "delta",
        });

        expect([...filtered.nodes.keys()]).toEqual([D]);
        expect(graph.nodes.size).toBe(5);
    });
});

describe("focused prerequisite explorer", () => {
    it("shows the selected course, direct prerequisites, and direct unlocks", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        const explorer = buildExplorerFlow(graph, {
            rootCode: B,
            prereqDepth: 1,
            unlockDepth: 1,
            roadmap,
            onSelect: () => {},
        });

        expect(explorer.nodes.map((node) => node.id).sort()).toEqual([A, B, C].sort());
        expect(explorer.edges).toHaveLength(2);
        expect(explorer.nodes.find((node) => node.id === B)?.data.isRoot).toBe(true);
    });

    it("expands one prerequisite level at a time", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        const direct = buildExplorerFlow(graph, {
            rootCode: C,
            prereqDepth: 1,
            unlockDepth: 1,
            roadmap,
            onSelect: () => {},
        });
        expect(direct.nodes.map((node) => node.id).sort()).toEqual([B, C].sort());
        expect(direct.hiddenPrereqs).toBe(1);

        const expanded = buildExplorerFlow(graph, {
            rootCode: C,
            prereqDepth: 2,
            unlockDepth: 1,
            roadmap,
            onSelect: () => {},
        });
        expect(expanded.nodes.map((node) => node.id).sort()).toEqual([A, B, C].sort());
        expect(expanded.hiddenPrereqs).toBe(0);
    });
});

describe("semester plan", () => {
    it("adds, moves, removes, and totals courses", () => {
        const graph = buildCourseGraph(mockData());

        let plan = emptySemesterPlan();
        plan = addCourseToPlan(plan, "fall", A);
        plan = addCourseToPlan(plan, "spring", B);

        expect(plan.fall).toEqual([A]);
        expect(plan.spring).toEqual([B]);
        expect(planCredits(plan, graph)).toEqual({ fall: 3, spring: 3, summer: 0 });

        plan = addCourseToPlan(plan, "fall", B);
        expect(plan.spring).toEqual([]);
        expect(plan.fall).toEqual([A, B]);
        expect(planCredits(plan, graph).fall).toBe(6);

        plan = removeCourseFromPlan(plan, A, "fall");
        expect(plan.fall).toEqual([B]);
    });

    it("warns about missing, same-semester, and out-of-order prerequisites", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        const missing = buildPlanWarnings(
            addCourseToPlan(emptySemesterPlan(), "fall", B),
            graph,
            roadmap
        );
        expect(missing.map((warning) => warning.id)).toContain(`missing-fall-${B}-${A}`);

        const sameSemester = buildPlanWarnings(
            addCourseToPlan(addCourseToPlan(emptySemesterPlan(), "fall", A), "fall", B),
            graph,
            roadmap
        );
        expect(sameSemester.some((warning) => warning.id === `same-fall-${B}-${A}`)).toBe(true);

        const later = buildPlanWarnings(
            addCourseToPlan(addCourseToPlan(emptySemesterPlan(), "fall", B), "spring", A),
            graph,
            roadmap
        );
        expect(later.some((warning) => warning.id === `later-fall-${B}-${A}`)).toBe(true);
    });

    it("flags a semester over the recommended credit maximum", () => {
        const graph = buildCourseGraph(mockData());
        const roadmap = buildRoadmap(graph, {
            completedCodes: EMPTY,
            inProgressCodes: EMPTY,
        });

        const plan = {
            ...emptySemesterPlan(),
            fall: [A, B, C, D, E, A, B],
        };

        const warnings = buildPlanWarnings(plan, graph, roadmap);
        expect(warnings.some((warning) => warning.id === "overload-fall")).toBe(true);
    });

    it("normalizes malformed stored plans safely", () => {
        expect(normalizeSemesterPlan(null)).toEqual(emptySemesterPlan());
        expect(
            normalizeSemesterPlan({ fall: [A, A, 42, ""], spring: "nope", summer: [B] })
        ).toEqual({ fall: [A], spring: [], summer: [B] });
    });
});
