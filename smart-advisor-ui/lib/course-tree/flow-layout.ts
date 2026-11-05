import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { Course } from "@/types";
import type {
    CourseCategory,
    CourseGraph,
    CourseTreeNode,
    CourseVisualState,
    TreeFilters,
} from "./types";
import { CATEGORY_ORDER } from "./types";
import { getAncestors, getDescendants } from "./course-graph";

export interface CourseNodeData extends Record<string, unknown> {
    course: Course;
    code: string;
    level: number;
    category: CourseCategory;
    state: CourseVisualState;
    direction: "LR" | "TB";
    isFocused: boolean;
    isPrereq: boolean;
    isUnlock: boolean;
    isDimmed: boolean;
    onToggle: (code: string) => void;
    onFocus: (code: string) => void;
    onOpenNotes?: (course: Course) => void;
}

const CATEGORY_RANK = new Map<CourseCategory, number>(
    CATEGORY_ORDER.map((category, index) => [category, index])
);

function primaryCategory(node: CourseTreeNode): CourseCategory {
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

function normalizeLevel(level: number | undefined): number {
    if (typeof level !== "number" || Number.isNaN(level)) return 1;
    return Math.min(5, Math.max(1, Math.round(level)));
}

function matchesQuery(node: CourseTreeNode, query: string): boolean {
    if (!query) return true;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
        node.course.name.toLowerCase().includes(needle) ||
        node.code.toLowerCase().includes(needle)
    );
}

export interface FlowLayoutOptions {
    completedCodes: Set<string>;
    filters: TreeFilters;
    focusCode: string | null;
    hoveredCode?: string | null;
    direction?: "LR" | "TB";
    isMobile?: boolean;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onFocusCourse: (code: string) => void;
    onOpenNotes?: (course: Course) => void;
}

export interface FlowLayoutResult {
    nodes: Node<CourseNodeData>[];
    edges: Edge[];
    width: number;
    height: number;
    direction: "LR" | "TB";
}

/**
 * Builds a clean, hierarchical DAG layout using Dagre and React Flow.
 * Supports horizontal Left-to-Right (desktop) and vertical Top-to-Bottom (mobile).
 */
export function buildFlowGraph(
    graph: CourseGraph,
    options: FlowLayoutOptions
): FlowLayoutResult {
    const isMobile = options.isMobile ?? false;
    const direction = options.direction ?? (isMobile ? "TB" : "LR");
    const isTB = direction === "TB";

    const NODE_WIDTH = isTB ? (isMobile ? 164 : 192) : (isMobile ? 180 : 204);
    const NODE_HEIGHT = isTB ? (isMobile ? 68 : 74) : (isMobile ? 74 : 80);

    // 1. Filter visible course codes
    const visibleCodes = new Set<string>();
    for (const code of graph.order) {
        const node = graph.nodes.get(code);
        if (!node) continue;
        if (!matchesQuery(node, options.filters.query)) continue;
        if (!options.filters.showCompleted && options.completedCodes.has(code)) continue;
        visibleCodes.add(code);
    }

    if (visibleCodes.size === 0) {
        return { nodes: [], edges: [], width: 0, height: 0, direction };
    }

    // 2. Identify focus/hover chains (prerequisites & unlocked dependents)
    const effectiveCode = options.focusCode ?? options.hoveredCode ?? null;
    const activeCode = effectiveCode && visibleCodes.has(effectiveCode)
        ? effectiveCode
        : null;

    const ancestors = activeCode ? getAncestors(graph, activeCode) : new Set<string>();
    const descendants = activeCode ? getDescendants(graph, activeCode) : new Set<string>();
    const hasActive = activeCode !== null;

    // 3. Configure Dagre graph
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: direction,
        align: "UL",
        nodesep: isTB ? (isMobile ? 18 : 24) : (isMobile ? 22 : 26),
        ranksep: isTB ? (isMobile ? 40 : 54) : (isMobile ? 54 : 68),
        marginx: 24,
        marginy: 24,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Find levels present in visible nodes
    const levelsPresent = new Set<number>();
    for (const code of visibleCodes) {
        const node = graph.nodes.get(code);
        if (!node) continue;
        levelsPresent.add(normalizeLevel(node.course.level));
    }
    const sortedLevels = [...levelsPresent].sort((a, b) => a - b);

    // Create anchor nodes for each level to enforce progressive left-to-right columns
    for (const lvl of sortedLevels) {
        g.setNode(`__anchor_${lvl}`, { width: 1, height: 1 });
    }
    for (let i = 0; i < sortedLevels.length - 1; i += 1) {
        g.setEdge(`__anchor_${sortedLevels[i]}`, `__anchor_${sortedLevels[i + 1]}`, {
            minlen: 1,
            weight: 1,
        });
    }

    // Add course nodes to Dagre
    for (const code of visibleCodes) {
        const node = graph.nodes.get(code);
        if (!node) continue;
        g.setNode(code, { width: NODE_WIDTH, height: NODE_HEIGHT });

        // Connect anchor to course to guide its horizontal band placement
        const lvl = normalizeLevel(node.course.level);
        g.setEdge(`__anchor_${lvl}`, code, { minlen: 1, weight: 1 });
    }

    // Add prerequisite edges to Dagre
    const visibleEdges = graph.edges.filter(
        (edge) => visibleCodes.has(edge.from) && visibleCodes.has(edge.to)
    );

    for (const edge of visibleEdges) {
        g.setEdge(edge.from, edge.to, { minlen: 1, weight: 2 });
    }

    // Run Dagre layout calculation
    dagre.layout(g);

    // 4. Construct React Flow nodes
    const nodes: Node<CourseNodeData>[] = [];
    let maxX = 0;
    let maxY = 0;

    for (const code of visibleCodes) {
        const node = graph.nodes.get(code);
        if (!node) continue;

        const dagreNode = g.node(code);
        if (!dagreNode) continue;

        const x = dagreNode.x - NODE_WIDTH / 2;
        const y = dagreNode.y - NODE_HEIGHT / 2;

        if (x + NODE_WIDTH > maxX) maxX = x + NODE_WIDTH;
        if (y + NODE_HEIGHT > maxY) maxY = y + NODE_HEIGHT;

        const isCurrentFocus = options.focusCode === code;
        const isCurrentActive = activeCode === code;
        const isPrereq = ancestors.has(code);
        const isUnlock = descendants.has(code);
        const isDimmed = hasActive && !isCurrentActive && !isPrereq && !isUnlock;

        const visualState = options.getCourseState(node.course);

        nodes.push({
            id: code,
            type: "courseNode",
            position: { x, y },
            data: {
                course: node.course,
                code,
                level: normalizeLevel(node.course.level),
                category: primaryCategory(node),
                state: visualState,
                direction,
                isFocused: isCurrentFocus,
                isPrereq,
                isUnlock,
                isDimmed,
                onToggle: options.onToggleCourse,
                onFocus: options.onFocusCourse,
                onOpenNotes: options.onOpenNotes,
            },
        });
    }

    // 5. Construct React Flow edges
    const edges: Edge[] = [];

    for (const edge of visibleEdges) {
        const edgeId = `${edge.from}->${edge.to}`;
        const isFromCompleted = options.completedCodes.has(edge.from);

        // Determine edge chain state relative to focus or hover
        let strokeColor = isFromCompleted ? "#0da55a" : "#9aa4b2";
        let strokeWidth = 1.6;
        let animated = false;
        let opacity = 1;

        if (hasActive) {
            const isPrereqEdge =
                (edge.to === activeCode && ancestors.has(edge.from)) ||
                (ancestors.has(edge.from) && ancestors.has(edge.to));
            const isUnlockEdge =
                (edge.from === activeCode && descendants.has(edge.to)) ||
                (descendants.has(edge.from) && descendants.has(edge.to));

            if (isPrereqEdge) {
                strokeColor = "#3b82f6"; // Blue for required prereqs
                strokeWidth = 2.5;
                animated = true;
            } else if (isUnlockEdge) {
                strokeColor = "#10b981"; // Emerald green for unlocked
                strokeWidth = 2.5;
                animated = true;
            } else {
                opacity = 0.18;
                strokeWidth = 1;
            }
        }

        edges.push({
            id: edgeId,
            source: edge.from,
            target: edge.to,
            type: "smoothstep",
            animated,
            style: {
                stroke: strokeColor,
                strokeWidth,
                opacity,
                strokeDasharray: edge.or ? "4 4" : undefined,
                transition: "stroke 0.25s, stroke-width 0.25s, opacity 0.25s",
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: strokeColor,
                width: 15,
                height: 15,
            },
        });
    }

    return {
        nodes,
        edges,
        width: maxX + 64,
        height: maxY + 64,
        direction,
    };
}

