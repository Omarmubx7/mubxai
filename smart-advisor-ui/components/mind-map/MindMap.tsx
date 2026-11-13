"use client";

/**
 * MindMap.tsx
 * NotebookLM-style interactive expandable mind map built on @xyflow/react.
 *
 * Features:
 *  - Accepts any hierarchical { id, label, children } JSON tree
 *  - Root node always visible; all other nodes start collapsed
 *  - Click/tap to toggle expansion (reveals only direct children — one level at a time)
 *  - PC: scroll-wheel zoom + click-drag pan
 *  - Mobile: 1-finger pan + 2-finger pinch-to-zoom
 *    (React Flow maps touchmove.scale → viewport.zoom internally;
 *     each pixel of pinch spread = proportional zoom delta clamped [0.15, 2.5])
 *  - Floating control bar: Zoom In (+), Zoom Out (-), Recenter (⌖), Expand All, Collapse
 *  - AnimatePresence wraps nodes so they fade/scale on mount/unmount
 */

import {
    memo,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    BackgroundVariant,
    useReactFlow,
    useViewport,
    type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { AnimatePresence } from "framer-motion";
import {
    Plus,
    Minus,
    Crosshair,
    ChevronsUpDown,
    ChevronsDownUp,
    Maximize2,
    Minimize2,
} from "lucide-react";

import { MindMapNode } from "./MindMapNode";
import {
    buildMindMapLayout,
    type MindMapTreeNode,
} from "./mind-map-layout";

// ─── Register custom node type ─────────────────────────────────────────────

const nodeTypes: NodeTypes = { mindMapNode: MindMapNode };

// ─── Public props ──────────────────────────────────────────────────────────

export interface MindMapProps {
    /** The root of the hierarchical tree */
    data: MindMapTreeNode;
    /** Optional title shown above the map */
    title?: string;
    /** Optional CSS class for the outer wrapper */
    className?: string;
}

// ─── Floating control bar ──────────────────────────────────────────────────

interface ControlsBarProps {
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onRecenter: () => void;
}

function ControlsBar({
    isFullscreen,
    onToggleFullscreen,
    onExpandAll,
    onCollapseAll,
    onRecenter,
}: Readonly<ControlsBarProps>) {
    // useReactFlow() gives us programmatic zoom/center — must be inside ReactFlowProvider
    const { zoomIn, zoomOut } = useReactFlow();
    const { zoom } = useViewport();

    return (
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#dde3ec] bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-sm">
            {/* Zoom percentage readout */}
            <span className="min-w-[36px] text-center font-mono text-[10px] font-black text-[#5a6472]">
                {Math.round(zoom * 100)}%
            </span>

            <div className="mx-1 h-4 w-px bg-[#dde3ec]" />

            {/* Zoom out — also reduces pinch-zoom scale on mobile */}
            <button
                type="button"
                onClick={() => zoomOut({ duration: 220 })}
                aria-label="Zoom out"
                title="Zoom out (scroll wheel ↓ or pinch close)"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dde3ec] text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Minus className="h-3.5 w-3.5" />
            </button>

            {/* Zoom in */}
            <button
                type="button"
                onClick={() => zoomIn({ duration: 220 })}
                aria-label="Zoom in"
                title="Zoom in (scroll wheel ↑ or pinch open)"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dde3ec] text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Plus className="h-3.5 w-3.5" />
            </button>

            {/* Recenter / Fit View ⌖ */}
            <button
                type="button"
                onClick={onRecenter}
                aria-label="Recenter view"
                title="Recenter and fit the whole map"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#dde3ec] text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Crosshair className="h-3.5 w-3.5" />
            </button>

            <div className="mx-1 h-4 w-px bg-[#dde3ec]" />

            {/* Expand all branches */}
            <button
                type="button"
                onClick={onExpandAll}
                title="Expand all branches"
                className="flex items-center gap-1 rounded-lg border border-[#dde3ec] px-2 py-1 text-[10px] font-bold text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <ChevronsUpDown className="h-3 w-3" />
                <span className="hidden sm:inline">Expand</span>
            </button>

            {/* Collapse back to root */}
            <button
                type="button"
                onClick={onCollapseAll}
                title="Collapse all branches"
                className="flex items-center gap-1 rounded-lg border border-[#dde3ec] px-2 py-1 text-[10px] font-bold text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <ChevronsDownUp className="h-3 w-3" />
                <span className="hidden sm:inline">Collapse</span>
            </button>

            <div className="mx-1 hidden h-4 w-px bg-[#dde3ec] sm:block" />

            {/* Fullscreen toggle */}
            <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className={`hidden sm:flex h-7 w-7 items-center justify-center rounded-lg border text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer ${
                    isFullscreen
                        ? "border-[#dc4835] bg-[#dc4835] text-white hover:text-white"
                        : "border-[#dde3ec]"
                }`}
            >
                {isFullscreen ? (
                    <Minimize2 className="h-3 w-3" />
                ) : (
                    <Maximize2 className="h-3 w-3" />
                )}
            </button>
        </div>
    );
}

// ─── Collect all IDs in the tree (for "Expand All") ───────────────────────

function collectAllIds(node: MindMapTreeNode, out: Set<string> = new Set()): Set<string> {
    out.add(node.id);
    for (const child of node.children ?? []) {
        collectAllIds(child, out);
    }
    return out;
}

// ─── Inner map (must be inside ReactFlowProvider) ─────────────────────────

function MindMapContent({
    data,
    title,
}: Readonly<Pick<MindMapProps, "data" | "title">>) {
    const { fitView } = useReactFlow();
    const containerRef = useRef<HTMLDivElement>(null);

    // Only the root starts expanded
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => new Set([data.id])
    );
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Escape key exits fullscreen
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isFullscreen]);

    // ── Expand/collapse handlers ───────────────────────────────────────────

    const handleToggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                // Collapse: remove this node AND all its descendants from expandedIds
                // so sub-branches don't re-appear next time we expand
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    const handleExpandAll = useCallback(() => {
        setExpandedIds(collectAllIds(data));
        setTimeout(() => fitView({ padding: 0.1, duration: 320 }), 60);
    }, [data, fitView]);

    const handleCollapseAll = useCallback(() => {
        // Keep only root expanded
        setExpandedIds(new Set([data.id]));
        setTimeout(
            () => fitView({ padding: 0.12, maxZoom: 1.1, duration: 320 }),
            60
        );
    }, [data.id, fitView]);

    const handleRecenter = useCallback(() => {
        fitView({ padding: 0.12, maxZoom: 1.1, duration: 350 });
    }, [fitView]);

    // ── Build React Flow nodes & edges from tree state ────────────────────

    const { nodes, edges } = useMemo(
        () => buildMindMapLayout(data, expandedIds, handleToggleExpand),
        [data, expandedIds, handleToggleExpand]
    );

    // Auto-fit whenever the visible graph changes size
    useEffect(() => {
        const timer = setTimeout(() => {
            fitView({ padding: 0.1, maxZoom: 1.1, duration: 280 });
        }, 80);
        return () => clearTimeout(timer);
    }, [nodes.length, fitView]);

    // ── Container style (normal vs fullscreen) ────────────────────────────

    const containerClass = isFullscreen
        ? "fixed inset-0 z-50 h-screen w-screen bg-[#f8fafc] rounded-none border-none"
        : "relative h-[72vh] min-h-[480px] max-h-[840px] w-full select-none overflow-hidden rounded-2xl border-2 border-[#dde3ec] bg-[#f8fafc] sm:h-[80vh]";

    return (
        <div ref={containerRef} className={containerClass}>
            {/* React Flow canvas
                panOnDrag={true}            → 1-finger/mouse drag pans the canvas
                zoomOnScroll={true}         → mouse wheel zooms
                zoomOnPinch={true}          → 2-finger pinch gesture maps:
                    touchmove.scale (ratio of new touch spread / initial spread)
                    → newZoom = prevZoom * scale (clamped to minZoom/maxZoom)
                preventScrolling={true}     → stops page scrolling inside the canvas
            */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                minZoom={0.15}
                maxZoom={2.5}
                fitView
                fitViewOptions={{ padding: 0.12, maxZoom: 1.1 }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                selectNodesOnDrag={false}
                panOnDrag={true}
                preventScrolling={true}
                zoomOnScroll={true}
                zoomOnPinch={true}  // ← enables 2-finger pinch-to-zoom on mobile
                panOnScroll={false}
                className="bg-[#f8fafc]"
                style={{ touchAction: "none" }}  // required for pinch gesture on iOS Safari
            >
                {/* Subtle dot grid background */}
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={28}
                    size={1.4}
                    color="#e2e8f0"
                />

                {/* Wrap edges in AnimatePresence so they smoothly appear/disappear */}
                <AnimatePresence />
            </ReactFlow>

            {/* Floating top-left: title + controls */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
                {/* Optional title pill */}
                {title && (
                    <div className="pointer-events-auto rounded-xl border border-[#dde3ec] bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                        <p className="text-xs font-black text-[#222d32]">{title}</p>
                    </div>
                )}

                {/* Zoom / expand controls */}
                <ControlsBar
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => setIsFullscreen((v) => !v)}
                    onExpandAll={handleExpandAll}
                    onCollapseAll={handleCollapseAll}
                    onRecenter={handleRecenter}
                />
            </div>

            {/* Legend: how to interact */}
            <div className="pointer-events-none absolute bottom-3 left-3 z-10">
                <p className="rounded-lg border border-[#dde3ec] bg-white/80 px-2.5 py-1 text-[10px] font-bold text-[#5a6472] backdrop-blur-sm">
                    Click node to expand · Drag to pan · Scroll / pinch to zoom
                </p>
            </div>
        </div>
    );
}

// ─── Public export (wraps content in ReactFlowProvider) ───────────────────

export default memo(function MindMap({ data, title, className }: Readonly<MindMapProps>) {
    return (
        <div className={className}>
            <ReactFlowProvider>
                <MindMapContent data={data} title={title} />
            </ReactFlowProvider>
        </div>
    );
});

