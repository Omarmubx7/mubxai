"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
    Background,
    BackgroundVariant,
    ReactFlow,
    ReactFlowProvider,
    useReactFlow,
    useViewport,
    type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    ChevronDown,
    ChevronUp,
    Maximize2,
    Minus,
    Network,
    Plus,
    RotateCcw,
} from "lucide-react";
import type { CourseGraph } from "@/lib/course-tree/types";
import type { RoadmapCourseInfo } from "@/lib/course-tree/roadmap";
import { ROADMAP_STATUS_ORDER } from "@/lib/course-tree/roadmap";
import { buildExplorerFlow } from "@/lib/course-tree/explorer-layout";
import { PrerequisiteExplorerNode } from "./PrerequisiteExplorerNode";
import { ROADMAP_STATUS_THEME } from "./visuals";

const nodeTypes: NodeTypes = { explorerNode: PrerequisiteExplorerNode };

export interface PrerequisiteExplorerProps {
    graph: CourseGraph;
    roadmap: Map<string, RoadmapCourseInfo>;
    rootCode: string | null;
    onRootChange: (code: string) => void;
    isMobile: boolean;
}

function ExplorerContent({
    graph,
    roadmap,
    rootCode,
    onRootChange,
    isMobile,
}: Readonly<PrerequisiteExplorerProps>) {
    const { fitView, zoomIn, zoomOut } = useReactFlow();
    const { zoom } = useViewport();

    const [prereqDepth, setPrereqDepth] = useDepthState(rootCode);
    const [unlockDepth, setUnlockDepth] = useDepthState(rootCode);

    const handleSelect = useCallback(
        (code: string) => {
            onRootChange(code);
        },
        [onRootChange]
    );

    const layout = useMemo(
        () =>
            buildExplorerFlow(graph, {
                rootCode,
                prereqDepth,
                unlockDepth,
                roadmap,
                isMobile,
                onSelect: handleSelect,
            }),
        [graph, rootCode, prereqDepth, unlockDepth, roadmap, isMobile, handleSelect]
    );

    const fit = useCallback(() => {
        fitView({ padding: 0.2, duration: 300, maxZoom: 1.15 });
    }, [fitView]);

    useEffect(() => {
        const timer = setTimeout(fit, 80);
        return () => clearTimeout(timer);
    }, [fit, layout.nodes.length, prereqDepth, unlockDepth, rootCode, isMobile]);

    const rootInfo = rootCode ? roadmap.get(rootCode) : null;

    return (
        <div className="space-y-3">
            <div className="rounded-xl border-2 border-[#dde3ec] bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1">
                        <label
                            htmlFor="explorer-course"
                            className="text-[9px] font-black uppercase tracking-[0.18em] text-[#5a6472]"
                        >
                            Start from a course
                        </label>
                        <select
                            id="explorer-course"
                            value={rootCode ?? ""}
                            onChange={(event) => onRootChange(event.target.value)}
                            className="mt-1 w-full rounded-lg border border-[#dde3ec] bg-white px-2.5 py-2 text-xs font-bold text-[#222d32] focus:border-[#dc4835] focus:outline-none"
                        >
                            <option value="">Select a course…</option>
                            {graph.order.map((code) => {
                                const node = graph.nodes.get(code);
                                if (!node) return null;
                                return (
                                    <option key={code} value={code}>
                                        {code} — {node.course.name}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {rootInfo && (
                        <p className="shrink-0 rounded-lg border border-[#dde3ec] bg-[#f8fafc] px-2.5 py-2 text-[10px] font-bold text-[#5a6472]">
                            <span className="font-black text-[#222d32]">
                                {rootInfo.prereqCodes.length}
                            </span>{" "}
                            direct prerequisite{rootInfo.prereqCodes.length === 1 ? "" : "s"} ·{" "}
                            <span className="font-black text-[#222d32]">
                                {rootInfo.unlockCodes.length}
                            </span>{" "}
                            unlocked
                        </p>
                    )}
                </div>

                {rootCode && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setPrereqDepth((depth) => depth + 1)}
                            disabled={layout.hiddenPrereqs === 0}
                            className="flex items-center gap-1 rounded-md border border-[#dde3ec] px-2 py-1 text-[9px] font-black text-[#5a6472] transition-colors hover:border-[#2563eb]/50 hover:text-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <ChevronUp className="h-3 w-3" />
                            {layout.hiddenPrereqs > 0
                                ? `${layout.hiddenPrereqs} earlier prerequisite${layout.hiddenPrereqs === 1 ? "" : "s"}`
                                : "All prerequisites shown"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setUnlockDepth((depth) => depth + 1)}
                            disabled={layout.hiddenUnlocks === 0}
                            className="flex items-center gap-1 rounded-md border border-[#dde3ec] px-2 py-1 text-[9px] font-black text-[#5a6472] transition-colors hover:border-[#0da55a]/50 hover:text-[#0f7a4a] disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            <ChevronDown className="h-3 w-3" />
                            {layout.hiddenUnlocks > 0
                                ? `${layout.hiddenUnlocks} further unlock${layout.hiddenUnlocks === 1 ? "" : "s"}`
                                : "All unlocks shown"}
                        </button>
                        <span className="ml-auto text-[9px] font-bold text-[#92604c]">
                            Click a node to focus it
                        </span>
                    </div>
                )}
            </div>

            {!rootCode || !rootInfo ? (
                <div className="rounded-xl border-2 border-dashed border-[#dde3ec] bg-white px-6 py-14 text-center">
                    <Network className="mx-auto h-6 w-6 text-[#9aa4b2]" />
                    <p className="mt-2 text-sm font-black text-[#222d32]">
                        Choose a course to explore its prerequisite chain
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs font-bold text-[#5a6472]">
                        The explorer shows one course, its direct prerequisites, and what it
                        unlocks. Expand one level at a time instead of reading the whole graph.
                    </p>
                </div>
            ) : (
                <div className="relative h-[62vh] min-h-[460px] w-full select-none overflow-hidden rounded-xl border-2 border-[#dde3ec] bg-[#f8fafc]">
                    <ReactFlow
                        nodes={layout.nodes}
                        edges={layout.edges}
                        nodeTypes={nodeTypes}
                        minZoom={0.2}
                        maxZoom={1.8}
                        fitView
                        fitViewOptions={{ padding: 0.2, maxZoom: 1.15 }}
                        nodesDraggable={false}
                        nodesConnectable={false}
                        elementsSelectable={false}
                        panOnDrag
                        preventScrolling
                        zoomOnScroll
                        zoomOnPinch
                        className="bg-[#f8fafc]"
                        style={{ touchAction: "none" }}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={26} size={1.2} color="#e2e8f0" />
                    </ReactFlow>

                    <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex flex-wrap items-center gap-1.5">
                        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-[#dde3ec] bg-white/95 px-1.5 py-1 shadow-sm backdrop-blur">
                            <span className="min-w-[32px] text-center font-mono text-[9px] font-black text-[#5a6472]">
                                {Math.round(zoom * 100)}%
                            </span>
                            <span className="mx-0.5 h-3.5 w-px bg-[#dde3ec]" />
                            <button
                                type="button"
                                onClick={() => zoomOut({ duration: 200 })}
                                aria-label="Zoom out"
                                className="flex h-5 w-5 items-center justify-center rounded border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835]"
                            >
                                <Minus className="h-2.5 w-2.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => zoomIn({ duration: 200 })}
                                aria-label="Zoom in"
                                className="flex h-5 w-5 items-center justify-center rounded border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835]"
                            >
                                <Plus className="h-2.5 w-2.5" />
                            </button>
                            <button
                                type="button"
                                onClick={fit}
                                aria-label="Fit graph to view"
                                title="Fit to view"
                                className="flex h-5 w-5 items-center justify-center rounded border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835]"
                            >
                                <Maximize2 className="h-2.5 w-2.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPrereqDepth(() => 1);
                                    setUnlockDepth(() => 1);
                                    setTimeout(fit, 80);
                                }}
                                title="Reset to direct prerequisites and unlocks"
                                className="flex items-center gap-1 rounded border border-[#dde3ec] px-1.5 py-0.5 text-[8px] font-black text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835]"
                            >
                                <RotateCcw className="h-2.5 w-2.5" />
                                Reset view
                            </button>
                        </div>

                        <div className="pointer-events-auto hidden items-center gap-2 rounded-lg border border-[#dde3ec] bg-white/95 px-2 py-1 text-[8px] font-bold text-[#5a6472] shadow-sm backdrop-blur sm:flex">
                            {ROADMAP_STATUS_ORDER.map((status) => (
                                <span key={status} className="flex items-center gap-1">
                                    <span
                                        className="h-1.5 w-1.5 rounded-full"
                                        style={{ background: ROADMAP_STATUS_THEME[status].dot }}
                                    />
                                    {status}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Depth state resets automatically whenever the focused course changes. */
function useDepthState(
    rootCode: string | null
): [number, (updater: (depth: number) => number) => void] {
    const [state, setState] = useState<{ root: string | null; depth: number }>({
        root: rootCode,
        depth: 1,
    });

    const depth = state.root === rootCode ? state.depth : 1;

    const setDepth = useCallback(
        (updater: (depth: number) => number) => {
            setState((previous) => {
                const base = previous.root === rootCode ? previous.depth : 1;
                return { root: rootCode, depth: updater(base) };
            });
        },
        [rootCode]
    );

    return [depth, setDepth];
}

export default memo(function PrerequisiteExplorer(props: Readonly<PrerequisiteExplorerProps>) {
    return (
        <ReactFlowProvider>
            <ExplorerContent {...props} />
        </ReactFlowProvider>
    );
});
