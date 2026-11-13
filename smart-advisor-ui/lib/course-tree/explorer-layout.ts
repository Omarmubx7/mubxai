import dagre from "@dagrejs/dagre";
import type { Edge, Node } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import type { CourseGraph } from "./types";
import type { RoadmapCourseInfo, RoadmapStatus } from "./roadmap";

export interface ExplorerNodeData extends Record<string, unknown> {
    code: string;
    name: string;
    ch: number;
    level: number;
    status: RoadmapStatus;
    isRoot: boolean;
    missingPrereqs: string[];
    direction: "LR" | "TB";
    onSelect: (code: string) => void;
}

export interface ExplorerFlowOptions {
    rootCode: string | null;
    /** 1 = direct prerequisites only, 2 = one more level, etc. */
    prereqDepth: number;
    /** 1 = direct unlocked courses only, 2 = one more level, etc. */
    unlockDepth: number;
    roadmap: Map<string, RoadmapCourseInfo>;
    direction?: "LR" | "TB";
    isMobile?: boolean;
    onSelect: (code: string) => void;
}

export interface ExplorerFlowResult {
    nodes: Node<ExplorerNodeData>[];
    edges: Edge[];
    width: number;
    height: number;
    hiddenPrereqs: number;
    hiddenUnlocks: number;
}

const EMPTY_RESULT: ExplorerFlowResult = {
    nodes: [],
    edges: [],
    width: 0,
    height: 0,
    hiddenPrereqs: 0,
    hiddenUnlocks: 0,
};

function directNeighbours(
    graph: CourseGraph,
    codes: string[],
    direction: "up" | "down"
): string[] {
    const result = new Set<string>();
    for (const code of codes) {
        const node = graph.nodes.get(code);
        if (!node) continue;
        const neighbours =
            direction === "up" ? node.prereqCodes : node.dependents;
        for (const neighbour of neighbours) {
            if (graph.nodes.has(neighbour)) result.add(neighbour);
        }
    }
    return [...result];
}

/**
 * Builds the focused prerequisite explorer: the selected course, its direct
 * prerequisites and direct unlocks, with one-level-at-a-time expansion on each
 * side. Rendering all 51 courses at once is explicitly avoided.
 */
export function buildExplorerFlow(
    graph: CourseGraph,
    options: ExplorerFlowOptions
): ExplorerFlowResult {
    const rootCode = options.rootCode;
    if (!rootCode || !graph.nodes.has(rootCode)) return EMPTY_RESULT;

    const isMobile = options.isMobile ?? false;
    const direction = options.direction ?? (isMobile ? "TB" : "LR");
    const isTB = direction === "TB";

    const visible = new Set<string>([rootCode]);

    const walk = (direction: "up" | "down", depth: number) => {
        let frontier = [rootCode];
        for (let level = 0; level < depth; level += 1) {
            const next = directNeighbours(graph, frontier, direction).filter(
                (code) => !visible.has(code)
            );
            for (const code of next) visible.add(code);
            frontier = next;
            if (frontier.length === 0) break;
        }
        return directNeighbours(graph, frontier, direction).filter(
            (code) => !visible.has(code)
        );
    };

    const pendingPrereqs = walk("up", Math.max(1, options.prereqDepth));
    const pendingUnlocks = walk("down", Math.max(1, options.unlockDepth));

    const NODE_WIDTH = isTB ? (isMobile ? 164 : 184) : isMobile ? 176 : 200;
    const NODE_HEIGHT = isTB ? 72 : 82;

    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: direction,
        align: "UL",
        nodesep: isTB ? 20 : 24,
        ranksep: isTB ? 44 : 64,
        marginx: 24,
        marginy: 24,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const code of visible) {
        g.setNode(code, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    const edges = graph.edges.filter(
        (edge) => visible.has(edge.from) && visible.has(edge.to)
    );
    for (const edge of edges) {
        g.setEdge(edge.from, edge.to, { minlen: 1, weight: 2 });
    }

    dagre.layout(g);

    let maxX = 0;
    let maxY = 0;

    const nodes: Node<ExplorerNodeData>[] = [];
    for (const code of visible) {
        const node = graph.nodes.get(code);
        const position = g.node(code);
        if (!node || !position) continue;

        const x = position.x - NODE_WIDTH / 2;
        const y = position.y - NODE_HEIGHT / 2;
        maxX = Math.max(maxX, x + NODE_WIDTH);
        maxY = Math.max(maxY, y + NODE_HEIGHT);

        const info = options.roadmap.get(code);

        nodes.push({
            id: code,
            type: "explorerNode",
            position: { x, y },
            data: {
                code,
                name: node.course.name,
                ch: node.course.ch,
                level: node.course.level ?? 1,
                status: info?.status ?? "Blocked",
                isRoot: code === rootCode,
                missingPrereqs: info?.missingPrereqs ?? [],
                direction,
                onSelect: options.onSelect,
            },
        });
    }

    const styledEdges: Edge[] = edges.map((edge) => {
        const fromStatus = options.roadmap.get(edge.from)?.status;
        const completed = fromStatus === "Completed";
        const stroke = completed ? "#7fae93" : "#94a3b8";
        return {
            id: `${edge.from}->${edge.to}`,
            source: edge.from,
            target: edge.to,
            type: "smoothstep",
            style: {
                stroke,
                strokeWidth: edge.from === rootCode ? 2 : 1.4,
                opacity: edge.from === rootCode ? 1 : 0.75,
                strokeDasharray: edge.or ? "4 4" : undefined,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: stroke,
                width: 14,
                height: 14,
            },
        };
    });

    return {
        nodes,
        edges: styledEdges,
        width: Math.max(maxX, 280),
        height: Math.max(maxY, 220),
        hiddenPrereqs: pendingPrereqs.length,
        hiddenUnlocks: pendingUnlocks.length,
    };
}
