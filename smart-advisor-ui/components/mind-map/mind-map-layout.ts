/**
 * mind-map-layout.ts
 * Converts a hierarchical MindMapNode tree into positioned React Flow nodes
 * and smooth bezier edges, using Dagre for collision-free layout.
 *
 * Layout direction: Left → Right (horizontal radial tree like NotebookLM)
 *   Root node anchored at left-center; branches fan out to the right.
 */

import dagre from "@dagrejs/dagre";
import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";

// ─── Public Tree Node ──────────────────────────────────────────────────────

export interface MindMapTreeNode {
    id: string;
    label: string;
    children?: MindMapTreeNode[];
    /** Optional: custom accent color for this branch */
    color?: string;
}

// ─── Internal flat node (what React Flow renders) ─────────────────────────

export interface MindMapNodeData extends Record<string, unknown> {
    label: string;
    depth: number;
    hasChildren: boolean;
    isExpanded: boolean;
    isRoot: boolean;
    /** Accent color inherited from the branch root */
    color: string;
    childCount: number;
    onToggleExpand: (id: string) => void;
}

// ─── Branch palette (8 distinct accent colors) ────────────────────────────

const BRANCH_COLORS = [
    "#dc4835", // brand red
    "#3b82f6", // blue
    "#10b981", // emerald
    "#f59e0b", // amber
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#84cc16", // lime
];

// ─── Layout constants ──────────────────────────────────────────────────────

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 44;
const ROOT_WIDTH = 200;
const ROOT_HEIGHT = 56;

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Flattens the tree into a list of visible nodes based on expandedIds.
 * Only direct children of an expanded node are revealed (one level at a time).
 */
function collectVisible(
    node: MindMapTreeNode,
    expandedIds: Set<string>,
    depth: number,
    branchColor: string,
    colorIndex: number,
    result: Array<{ node: MindMapTreeNode; depth: number; parentId: string | null; color: string }>
): void {
    result.push({ node, depth, parentId: null, color: branchColor });

    // Only reveal children if this node is explicitly expanded
    if (!expandedIds.has(node.id)) return;
    const children = node.children ?? [];

    children.forEach((child, idx) => {
        // Each depth-1 child gets its own branch color
        const childColor =
            depth === 0
                ? BRANCH_COLORS[idx % BRANCH_COLORS.length]
                : branchColor;

        // Temporarily push child with parentId to be assigned below
        const before = result.length;
        result.push({ node: child, depth: depth + 1, parentId: node.id, color: childColor });
        // Recurse into child's children
        if (expandedIds.has(child.id)) {
            const temp: typeof result = [];
            collectVisible(child, expandedIds, depth + 1, childColor, colorIndex + idx, temp);
            // Replace the child entry we just pushed with the full subtree
            result.splice(before, 1, ...temp);
        }
    });
}

/**
 * Walk tree and collect ALL (node, parentId, depth, color) tuples that are
 * currently visible given the expandedIds set.
 */
function buildVisibleList(
    root: MindMapTreeNode,
    expandedIds: Set<string>
): Array<{ node: MindMapTreeNode; depth: number; parentId: string | null; color: string }> {
    const result: Array<{ node: MindMapTreeNode; depth: number; parentId: string | null; color: string }> = [];
    walkVisible(root, null, expandedIds, 0, BRANCH_COLORS[0], result);
    return result;
}

function walkVisible(
    node: MindMapTreeNode,
    parentId: string | null,
    expandedIds: Set<string>,
    depth: number,
    inheritedColor: string,
    result: Array<{ node: MindMapTreeNode; depth: number; parentId: string | null; color: string }>
): void {
    // Assign branch color: depth-1 nodes each get a unique color; deeper nodes inherit their branch's
    const color = node.color ?? inheritedColor;
    result.push({ node, depth, parentId, color });

    if (!expandedIds.has(node.id)) return; // stop if not expanded

    const children = node.children ?? [];
    children.forEach((child, idx) => {
        const childColor =
            depth === 0
                ? (child.color ?? BRANCH_COLORS[idx % BRANCH_COLORS.length])
                : color;
        walkVisible(child, node.id, expandedIds, depth + 1, childColor, result);
    });
}

// ─── Main layout function ──────────────────────────────────────────────────

export interface MindMapLayoutResult {
    nodes: Node<MindMapNodeData>[];
    edges: Edge[];
}

export function buildMindMapLayout(
    root: MindMapTreeNode,
    expandedIds: Set<string>,
    onToggleExpand: (id: string) => void
): MindMapLayoutResult {
    // 1. Collect all visible nodes from the tree
    const visible = buildVisibleList(root, expandedIds);

    if (visible.length === 0) {
        return { nodes: [], edges: [] };
    }

    // 2. Build Dagre graph for automatic, collision-free placement
    const g = new dagre.graphlib.Graph();
    g.setGraph({
        rankdir: "LR",   // Left → Right: root on left, branches fan right
        align: "UL",
        nodesep: 20,     // Vertical gap between sibling nodes
        ranksep: 72,     // Horizontal gap between depth levels
        marginx: 40,
        marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes to Dagre
    for (const { node, depth } of visible) {
        const w = depth === 0 ? ROOT_WIDTH : NODE_WIDTH;
        const h = depth === 0 ? ROOT_HEIGHT : NODE_HEIGHT;
        g.setNode(node.id, { width: w, height: h });
    }

    // Add edges (parent → child) to drive Dagre's rank assignment
    for (const { node, parentId } of visible) {
        if (parentId !== null) {
            g.setEdge(parentId, node.id, { minlen: 1, weight: 2 });
        }
    }

    // Run layout
    dagre.layout(g);

    // 3. Build React Flow nodes
    const rfNodes: Node<MindMapNodeData>[] = visible.map(({ node, depth, color }) => {
        const w = depth === 0 ? ROOT_WIDTH : NODE_WIDTH;
        const h = depth === 0 ? ROOT_HEIGHT : NODE_HEIGHT;
        const dagreNode = g.node(node.id);

        const hasChildren = (node.children?.length ?? 0) > 0;

        return {
            id: node.id,
            type: "mindMapNode",
            position: {
                x: dagreNode.x - w / 2,
                y: dagreNode.y - h / 2,
            },
            data: {
                label: node.label,
                depth,
                hasChildren,
                isExpanded: expandedIds.has(node.id),
                isRoot: depth === 0,
                color,
                childCount: node.children?.length ?? 0,
                onToggleExpand,
            },
            // Prevent React Flow from letting users drag individual nodes
            draggable: false,
            selectable: false,
        };
    });

    // 4. Build React Flow edges (smooth bezier curves)
    const rfEdges: Edge[] = [];
    for (const { node, parentId, depth, color } of visible) {
        if (parentId === null) continue;

        // Edge color matches the branch color; root edges are slightly muted
        const strokeColor = depth === 1 ? color : color + "cc";
        const strokeWidth = depth === 1 ? 2 : 1.5;

        rfEdges.push({
            id: `${parentId}->${node.id}`,
            source: parentId,
            target: node.id,
            type: "smoothstep",
            animated: false,
            style: {
                stroke: strokeColor,
                strokeWidth,
                // CSS transition so edges animate when nodes appear/disappear
                transition: "stroke 0.3s, opacity 0.3s",
            },
            // No arrowhead — NotebookLM style uses clean lines
            markerEnd: undefined,
        });
    }

    return { nodes: rfNodes, edges: rfEdges };
}

