import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Course, CourseData } from "@/types";
import {
    collectPrereqGates,
    flattenPrereqCodes,
    parsePrerequisite,
} from "@/lib/course-tree/prereq-parser";
import { buildCourseGraph } from "@/lib/course-tree/course-graph";
import {
    buildOutlineModel,
    layoutDependencyMap,
} from "@/lib/course-tree/tree-layout";
import { buildFlowGraph } from "@/lib/course-tree/flow-layout";

function makeCourse(
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
        university_requirements: [
            makeCourse("10000001", "Alpha", 3, 1),
            makeCourse("10000002", "Beta", 3, 2, "10000001"),
        ],
        college_requirements: [],
        university_electives: [],
        department_requirements: [
            makeCourse("10000003", "Gamma", 3, 3, "10000002"),
            makeCourse("10000004", "Delta", 3, 4, "10000002 AND 999999"),
            makeCourse("10000005", "Epsilon", 3, 4, ">= 90 CH"),
        ],
        electives: [],
    };
}

describe("prerequisite parser", () => {
    it("treats commas as AND", () => {
        const expr = parsePrerequisite("00103230, 00103213");
        expect(expr?.kind).toBe("and");
        expect(flattenPrereqCodes(expr).sort()).toEqual(["00103213", "00103230"]);
    });

    it("handles & and OR", () => {
        const expr = parsePrerequisite("40201100 & 40303221");
        expect(expr?.kind).toBe("and");

        const orExpr = parsePrerequisite("00103250 or 00101535");
        expect(orExpr?.kind).toBe("or");
        expect(flattenPrereqCodes(orExpr).sort()).toEqual(["00101535", "00103250"]);
    });

    it("parses credit-hour gates", () => {
        const expr = parsePrerequisite(">= 90 CH");
        const gates = collectPrereqGates(expr);
        expect(gates).toHaveLength(1);
        expect(gates[0].gate).toBe("ch");
        expect(gates[0].requiredCH).toBe(90);
        expect(flattenPrereqCodes(expr)).toEqual([]);
    });

    it("parses approval and passed-hours combinations", () => {
        const expr = parsePrerequisite("40302231, Dept. Approval, Passed 100 CHs");
        expect(flattenPrereqCodes(expr)).toEqual(["40302231"]);
        const gates = collectPrereqGates(expr).map((gate) => gate.label);
        expect(gates).toContain("Department Approval");
        expect(gates).toContain("Passed 100 CH");
    });

    it("parses concurrency alternatives", () => {
        const expr = parsePrerequisite("106493 or (up to 12 hrs Concurrent)");
        expect(expr?.kind).toBe("or");
        expect(flattenPrereqCodes(expr)).toEqual(["106493"]);
        const gates = collectPrereqGates(expr);
        expect(gates[0].gate).toBe("concurrent");
        expect(gates[0].label).toContain("12");
    });

    it("returns null for empty prerequisites", () => {
        expect(parsePrerequisite(undefined)).toBeNull();
        expect(parsePrerequisite("   ")).toBeNull();
    });

    it("normalises 10-digit codes that start with 00", () => {
        const expr = parsePrerequisite("0010123456", {
            code_regex: "\\b\\d{6,10}\\b",
            stripping: { leading_zeros_if_length: 10, target_length: 8 },
        });
        expect(flattenPrereqCodes(expr)).toEqual(["10123456"]);
    });
});

describe("course graph", () => {
    it("builds nodes, edges, depths and external requirements", () => {
        const graph = buildCourseGraph(mockData());

        expect(graph.nodes.size).toBe(5);
        expect(graph.edges).toHaveLength(3);
        expect(graph.cycles).toHaveLength(0);
        expect(graph.depths.get("10000001")).toBe(0);
        expect(graph.depths.get("10000002")).toBe(1);
        expect(graph.depths.get("10000003")).toBe(2);
        expect(graph.depths.get("10000004")).toBe(2);

        const delta = graph.nodes.get("10000004");
        expect(delta?.externalPrereqCodes).toEqual(["999999"]);
        expect(graph.externalCodes).toEqual(["999999"]);

        const epsilon = graph.nodes.get("10000005");
        expect(epsilon?.gates.map((gate) => gate.label)).toEqual(["\u2265 90 CH"]);
    });
});

describe("tree layout", () => {
    it("builds year and category groups", () => {
        const graph = buildCourseGraph(mockData());
        const completed = new Set(["10000001"]);
        const years = buildOutlineModel(graph, { query: "", showCompleted: true }, completed);

        expect(years.map((year) => year.level)).toEqual([1, 2, 3, 4]);
        expect(years[0].completedCH).toBe(3);
        expect(years[3].courses).toHaveLength(2);
    });

    it("filters by query and completion", () => {
        const graph = buildCourseGraph(mockData());
        const completed = new Set(["10000001"]);

        const searched = buildOutlineModel(
            graph,
            { query: "gamma", showCompleted: true },
            completed
        );
        expect(searched).toHaveLength(1);
        expect(searched[0].courses[0].node.code).toBe("10000003");

        const hiddenCompleted = buildOutlineModel(
            graph,
            { query: "", showCompleted: false },
            completed
        );
        const codes = hiddenCompleted.flatMap((year) =>
            year.courses.map((entry) => entry.node.code)
        );
        expect(codes).not.toContain("10000001");
        expect(codes).toContain("10000002");
    });

    it("produces deterministic, non-overlapping map positions", () => {
        const graph = buildCourseGraph(mockData());
        const first = layoutDependencyMap(graph, {
            completedCodes: new Set(),
            filters: { query: "", showCompleted: true },
        });
        const second = layoutDependencyMap(graph, {
            completedCodes: new Set(),
            filters: { query: "", showCompleted: true },
        });

        expect(first.nodes).toEqual(second.nodes);
        expect(first.bands).toHaveLength(4);
        expect(first.edges).toHaveLength(3);

        const seen = new Set<string>();
        for (const node of first.nodes) {
            const key = `${node.x}:${node.y}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
        }
    });

    it("spreads dense same-band routes across distinct lanes", () => {
        const graph = {
            nodes: new Map(
                ["A", "B", "C", "D", "E", "F"].map((code, index) => [
                    code,
                    {
                        code,
                        course: {
                            code,
                            name: `Course ${code}`,
                            ch: 3,
                            framework: "HTU",
                            level: 1 as const,
                        },
                        categories: ["Department Requirements"],
                        order: index,
                        prereqCodes: [],
                        dependents: [],
                        prereqExpr: null,
                        gates: [],
                        externalPrereqCodes: [],
                        prereq: "",
                    },
                ])
            ),
            order: ["A", "B", "C", "D", "E", "F"],
            edges: [
                { from: "A", to: "F", or: false },
                { from: "B", to: "F", or: false },
                { from: "C", to: "F", or: false },
                { from: "D", to: "F", or: false },
                { from: "E", to: "F", or: false },
            ],
            roots: [],
            depths: new Map(),
            cycles: [],
            externalCodes: [],
        };

        const layout = layoutDependencyMap(graph as any, {
            completedCodes: new Set(),
            filters: { query: "", showCompleted: true },
        });

        // Edges produce distinct paths
        expect(layout.edges.length).toBe(5);
        expect(new Set(layout.edges.map((e) => e.path)).size).toBe(5);
    });
});

describe("real curriculum", () => {
    const raw = JSON.parse(
        readFileSync(path.resolve(process.cwd(), "public/data/curriculum.json"), "utf8")
    ) as {
        majors: Record<string, CourseData>;
        shared: Pick<
            CourseData,
            "university_requirements" | "university_electives" | "college_requirements"
        >;
    };

    function dataFor(key: string): CourseData {
        const major = raw.majors[key];
        return {
            university_requirements: [...raw.shared.university_requirements, ...(major.university_requirements ?? [])],
            university_electives: [...raw.shared.university_electives, ...(major.university_electives ?? [])],
            college_requirements: [...raw.shared.college_requirements, ...(major.college_requirements ?? [])],
            department_requirements: major.department_requirements ?? [],
            electives: major.electives ?? [],
        };
    }

    it.each(["computer_science", "electrical_engineering", "game_design"])(
        "parses %s without cycles and lays it out",
        (key) => {
            const graph = buildCourseGraph(dataFor(key));
            expect(graph.nodes.size).toBeGreaterThan(20);
            expect(graph.edges.length).toBeGreaterThan(10);
            expect(graph.cycles).toHaveLength(0);

            const layout = layoutDependencyMap(graph, {
                completedCodes: new Set(),
                filters: { query: "", showCompleted: true },
            });
            expect(layout.nodes).toHaveLength(graph.nodes.size);
            expect(layout.width).toBeGreaterThan(0);
            expect(layout.height).toBeGreaterThan(0);

            // Landscape tiles on real data.
            for (const node of layout.nodes) {
                expect(node.width).toBeGreaterThan(node.height);
            }
            expect(layout.bands.every((band) => band.rows >= 1)).toBe(true);

            // Column bands placed left to right
            for (let i = 1; i < layout.bands.length; i += 1) {
                expect(layout.bands[i].x).toBeGreaterThan(layout.bands[i - 1].x);
            }
        }
    );

    it("generates a clean React Flow DAG with buildFlowGraph", () => {
        const graph = buildCourseGraph(dataFor("computer_science"));
        const flow = buildFlowGraph(graph, {
            completedCodes: new Set(["10000001"]),
            filters: { query: "", showCompleted: true },
            focusCode: null,
            getCourseState: () => ({
                isCompleted: false,
                isInProgress: false,
                isLocked: false,
                hasPrereqWarning: false,
                missingPrereqs: [],
                isSandboxSelected: false,
                isDimmed: false,
            }),
            onToggleCourse: () => {},
            onFocusCourse: () => {},
        });

        expect(flow.nodes.length).toBe(graph.nodes.size);
        expect(flow.edges.length).toBeGreaterThan(10);
        expect(flow.width).toBeGreaterThan(0);
        expect(flow.height).toBeGreaterThan(0);

        // Every node has an ID, position, and type courseNode
        for (const node of flow.nodes) {
            expect(node.id).toBeTruthy();
            expect(node.type).toBe("courseNode");
            expect(node.position.x).toBeGreaterThanOrEqual(0);
            expect(node.position.y).toBeGreaterThanOrEqual(0);
        }

        // Edges have valid sources and targets in the node set
        const nodeIds = new Set(flow.nodes.map((n) => n.id));
        for (const edge of flow.edges) {
            expect(nodeIds.has(edge.source)).toBe(true);
            expect(nodeIds.has(edge.target)).toBe(true);
        }
    });

    it("generates a mobile-optimized Top-to-Bottom DAG with direction='TB'", () => {
        const graph = buildCourseGraph(dataFor("computer_science"));
        const flow = buildFlowGraph(graph, {
            completedCodes: new Set(),
            filters: { query: "", showCompleted: true },
            focusCode: null,
            direction: "TB",
            isMobile: true,
            getCourseState: () => ({
                isCompleted: false,
                isInProgress: false,
                isLocked: false,
                hasPrereqWarning: false,
                missingPrereqs: [],
                isSandboxSelected: false,
                isDimmed: false,
            }),
            onToggleCourse: () => {},
            onFocusCourse: () => {},
        });

        expect(flow.direction).toBe("TB");
        expect(flow.nodes.length).toBe(graph.nodes.size);
        expect(flow.width).toBeGreaterThan(0);
        expect(flow.height).toBeGreaterThan(0);

        // Nodes have direction set to TB
        for (const node of flow.nodes) {
            expect(node.data.direction).toBe("TB");
        }
    });
});
