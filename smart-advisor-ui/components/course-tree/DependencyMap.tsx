"use client";

import { memo, useMemo, useCallback, useEffect, useRef, useState } from "react";
import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    useReactFlow,
    useViewport,
    type NodeTypes,
    type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
    ArrowRight,
    Maximize2,
    Minimize2,
    Minus,
    Plus,
    X,
    CheckCircle2,
    FileText,
    Lock,
    Rows,
    Columns,
    Eye,
} from "lucide-react";
import type { Course } from "@/types";
import type {
    CourseGraph,
    CourseVisualState,
    MapLayout,
    TreeFilters,
} from "@/lib/course-tree/types";
import { buildFlowGraph, type CourseNodeData } from "@/lib/course-tree/flow-layout";
import { FlowCourseNode } from "./FlowCourseNode";
import { FrameworkBadge, statusLabel } from "./visuals";

const nodeTypes: NodeTypes = {
    courseNode: FlowCourseNode,
};

export interface DependencyMapProps {
    graph: CourseGraph;
    layout?: MapLayout;
    filters?: TreeFilters;
    focusCode: string | null;
    completedCodes: Set<string>;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onFocus: (code: string | null) => void;
    onOpenNotes: (course: Course) => void;
    isMobile: boolean;
    criticalCodes?: Set<string>;
    initialMapMode?: "all" | "focus";
    compactLabels?: boolean;
}

function miniMapNodeColor(node: Node): string {
    const data = node.data as CourseNodeData | undefined;
    if (!data) return "#9aa4b2";
    if (data.isFocused) return "#dc4835";
    if (data.isPrereq) return "#3b82f6";
    if (data.isUnlock) return "#10b981";
    if (data.state?.isCompleted) return "#0da55a";
    if (data.state?.isInProgress) return "#f39c14";
    return "#e2e8f0";
}

interface ZoomControlsBarProps {
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    direction: "LR" | "TB";
    onToggleDirection: () => void;
    onResetReadable: () => void;
    onFitAll: () => void;
}

function ZoomControlsBar({
    isFullscreen,
    onToggleFullscreen,
    direction,
    onToggleDirection,
    onResetReadable,
    onFitAll,
}: Readonly<ZoomControlsBarProps>) {
    const { zoomIn, zoomOut } = useReactFlow();
    const { zoom } = useViewport();

    return (
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 sm:gap-1.5 rounded-lg border border-[#dde3ec] bg-white/95 px-2 py-1 text-[10px] font-bold text-[#5a6472] shadow-sm backdrop-blur">
            {/* Direction toggle */}
            <button
                type="button"
                onClick={onToggleDirection}
                title={
                    direction === "TB"
                        ? "Switch to Horizontal layout (Left to Right)"
                        : "Switch to Vertical mobile-friendly layout (Top to Bottom)"
                }
                className="flex items-center gap-1 rounded border border-[#dde3ec] px-1.5 py-0.5 text-[9px] font-black text-[#222d32] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                {direction === "TB" ? (
                    <>
                        <Rows className="h-3 w-3 text-[#dc4835]" />
                        <span className="hidden sm:inline">Vertical</span>
                    </>
                ) : (
                    <>
                        <Columns className="h-3 w-3 text-[#dc4835]" />
                        <span className="hidden sm:inline">Horizontal</span>
                    </>
                )}
            </button>

            <span className="hidden sm:inline-block h-3.5 w-px bg-[#dde3ec]" />

            {/* Zoom Percentage */}
            <span
                data-testid="map-zoom-level"
                className="font-mono text-[9px] font-black text-[#222d32] min-w-[28px] text-center"
            >
                {Math.round(zoom * 100)}%
            </span>

            {/* Zoom In */}
            <button
                type="button"
                onClick={() => zoomIn({ duration: 250 })}
                title="Zoom in"
                aria-label="Zoom in"
                className="flex h-5 w-5 items-center justify-center rounded border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Plus className="h-3 w-3" />
            </button>

            {/* Zoom Out */}
            <button
                type="button"
                onClick={() => zoomOut({ duration: 250 })}
                title="Zoom out"
                aria-label="Zoom out"
                className="flex h-5 w-5 items-center justify-center rounded border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Minus className="h-3 w-3" />
            </button>

            {/* 100% Readable size button */}
            <button
                type="button"
                onClick={onResetReadable}
                title="Reset to 100% readable card size (no zoom needed)"
                className="flex items-center gap-0.5 rounded border border-[#dde3ec] px-1.5 py-0.5 text-[8.5px] font-black text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Eye className="h-2.5 w-2.5" />
                <span>100%</span>
            </button>

            {/* Fit to screen button */}
            <button
                type="button"
                onClick={onFitAll}
                title="Fit entire graph to screen"
                aria-label="Fit graph to view"
                className="flex h-5 w-5 items-center justify-center rounded border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
            >
                <Maximize2 className="h-2.5 w-2.5" />
            </button>

            {/* Fullscreen toggle button for PC */}
            <button
                type="button"
                onClick={onToggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand to Fullscreen"}
                aria-label={isFullscreen ? "Exit Fullscreen" : "Expand to Fullscreen"}
                className={`flex h-5 w-5 items-center justify-center rounded border text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer ${
                    isFullscreen ? "border-[#dc4835] bg-[#dc4835] text-white hover:text-white" : "border-[#dde3ec]"
                }`}
            >
                {isFullscreen ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
            </button>
        </div>
    );
}

function DependencyMapContent({
    graph,
    filters = { query: "", showCompleted: true },
    focusCode,
    completedCodes,
    getCourseState,
    onToggleCourse,
    onFocus,
    onOpenNotes,
    isMobile,
}: Readonly<DependencyMapProps>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { setCenter, fitView, setViewport } = useReactFlow();
    const { zoom } = useViewport();
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);

    // Layout direction: on mobile default to TB (vertical top-to-bottom); on desktop default to LR
    const [direction, setDirection] = useState<"LR" | "TB">(() => (isMobile ? "TB" : "LR"));
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Sync direction if isMobile changes
    useEffect(() => {
        if (isMobile) {
            setDirection("TB");
        }
    }, [isMobile]);

    // Handle escape key to exit fullscreen
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isFullscreen) {
                setIsFullscreen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isFullscreen]);

    // Ensure the React Flow viewport has data-testid="map-canvas" for test compatibility
    useEffect(() => {
        const viewport = containerRef.current?.querySelector(".react-flow__viewport");
        if (viewport) {
            viewport.setAttribute("data-testid", "map-canvas");
        }
    }, [direction, isFullscreen]);

    // Smoothly focus course and center camera on it
    const handleFocusCourse = useCallback(
        (code: string | null) => {
            if (!code || focusCode === code) {
                onFocus(null);
                return;
            }
            onFocus(code);
        },
        [onFocus, focusCode]
    );

    // Compute nodes & edges using Dagre with active direction
    const { nodes, edges } = useMemo(
        () =>
            buildFlowGraph(graph, {
                completedCodes,
                filters,
                focusCode,
                hoveredCode,
                direction,
                isMobile,
                getCourseState,
                onToggleCourse,
                onFocusCourse: handleFocusCourse,
                onOpenNotes,
            }),
        [
            graph,
            completedCodes,
            filters,
            focusCode,
            hoveredCode,
            direction,
            isMobile,
            getCourseState,
            onToggleCourse,
            handleFocusCourse,
            onOpenNotes,
        ]
    );

    // Initial readable load: center at first node with 100% / 95% zoom so students never start with tiny unreadable cards
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!initializedRef.current && nodes.length > 0) {
            initializedRef.current = true;
            const targetZoom = isMobile ? 0.88 : 0.95;
            const firstNode = nodes[0];
            const timer = setTimeout(() => {
                setCenter(firstNode.position.x + (isMobile ? 80 : 100), firstNode.position.y + 40, {
                    zoom: targetZoom,
                    duration: 350,
                });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [nodes, isMobile, setCenter]);

    // Reset to 100% readable view centered at start of curriculum
    const handleResetReadable = useCallback(() => {
        if (nodes.length > 0) {
            const firstNode = nodes[0];
            setCenter(firstNode.position.x + 90, firstNode.position.y + 40, {
                zoom: 1.0,
                duration: 350,
            });
        } else {
            setViewport({ x: 40, y: 40, zoom: 1.0 }, { duration: 300 });
        }
    }, [nodes, setCenter, setViewport]);

    // Fit whole graph into view
    const handleFitAll = useCallback(() => {
        fitView({
            padding: isMobile ? 0.12 : 0.18,
            duration: 350,
            minZoom: isMobile ? 0.6 : 0.45,
            maxZoom: 1.1,
        });
    }, [fitView, isMobile]);

    // Auto-center camera when focus changes
    useEffect(() => {
        if (!focusCode) return;
        const targetNode = nodes.find((n) => n.id === focusCode);
        if (targetNode) {
            setCenter(
                targetNode.position.x + 102,
                targetNode.position.y + 40,
                { zoom: Math.max(0.9, zoom), duration: 400 }
            );
        }
    }, [focusCode, nodes, setCenter, zoom]);

    // Focused course inspector details
    const focusNode = focusCode ? graph.nodes.get(focusCode) ?? null : null;
    const focusState = focusNode ? getCourseState(focusNode.course) : null;

    const prerequisiteChips = focusNode
        ? focusNode.prereqCodes.map((code) => {
              const node = graph.nodes.get(code);
              return { code, name: node?.course.name ?? `External ${code}`, external: !node };
          })
        : [];

    const unlockChips = focusNode
        ? focusNode.dependents.map((code) => ({
              code,
              name: graph.nodes.get(code)?.course.name ?? code,
          }))
        : [];

    if (nodes.length === 0) {
        return (
            <div className="rounded-xl border-2 border-dashed border-[#dde3ec] bg-white px-6 py-14 text-center">
                <p className="text-sm font-black text-[#222d32]">Nothing to map</p>
                <p className="mt-1 text-xs font-bold text-[#5a6472]">
                    Try clearing the filters or showing completed courses.
                </p>
            </div>
        );
    }

    const containerStyle = isFullscreen
        ? "fixed inset-0 z-50 h-screen w-screen bg-[#f8fafc] p-2 sm:p-4 rounded-none border-none shadow-2xl"
        : "relative h-[72vh] min-h-[500px] max-h-[880px] w-full select-none overflow-hidden rounded-xl border-2 border-[#dde3ec] bg-[#f8fafc] sm:h-[82vh] sm:min-h-[580px]";

    return (
        <div ref={containerRef} data-testid="tree-map" className={containerStyle}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                minZoom={0.15}
                maxZoom={1.6}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
                onNodeClick={(_event, node) => handleFocusCourse(node.id)}
                onNodeMouseEnter={(_event, node) => setHoveredCode(node.id)}
                onNodeMouseLeave={() => setHoveredCode(null)}
                onPaneClick={() => {
                    onFocus(null);
                    setHoveredCode(null);
                }}
                className="bg-[#f8fafc]"
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1.2}
                    color="#cbd5e1"
                />

                <Controls
                    showInteractive={false}
                    className="!left-3 !bottom-3 !border-2 !border-[#dde3ec] !bg-white/95 !shadow-sm !rounded-lg"
                />

                {!isMobile && (
                    <MiniMap
                        nodeStrokeWidth={2}
                        nodeColor={miniMapNodeColor}
                        zoomable
                        pannable
                        className="!right-3 !bottom-3 !border-2 !border-[#dde3ec] !rounded-xl !bg-white/95 !shadow-md"
                        style={{ width: 140, height: 95 }}
                    />
                )}
            </ReactFlow>

            {/* Top Bar Indicator / Chain Legend & Zoom Tools */}
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
                <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-[#dde3ec] bg-white/95 px-2.5 py-1.5 text-[9px] font-bold text-[#5a6472] shadow-sm backdrop-blur">
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#3b82f6]" /> Prerequisite
                    </span>
                    <span className="flex items-center gap-1">
                        <ArrowRight className="h-2.5 w-2.5 text-[#5a6472]" />
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-[#10b981]" /> Unlocked
                    </span>
                </div>

                <ZoomControlsBar
                    isFullscreen={isFullscreen}
                    onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
                    direction={direction}
                    onToggleDirection={() => setDirection((prev) => (prev === "LR" ? "TB" : "LR"))}
                    onResetReadable={handleResetReadable}
                    onFitAll={handleFitAll}
                />
            </div>

            {/* Focus Course Inspector Panel */}
            {focusNode && focusState && (
                <div
                    data-map-no-pan
                    className="absolute right-3 top-3 z-20 max-h-[calc(100%_-_1.5rem)] w-[min(20rem,calc(100%_-_1.5rem))] overflow-y-auto rounded-xl border-2 border-[#dde3ec] bg-white/98 p-3.5 shadow-xl backdrop-blur sm:p-4 animate-in fade-in zoom-in-95 duration-200"
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <p className="text-[13px] font-black leading-tight text-[#222d32]">
                                {focusNode.course.name}
                            </p>
                            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-[#5a6472]">
                                <span className="font-mono tracking-wider text-[#92604c]">
                                    {focusNode.code}
                                </span>
                                <span>{focusNode.course.ch} CH</span>
                                <FrameworkBadge framework={focusNode.course.framework} />
                                <span className="rounded bg-[#edf1f6] px-1.5 py-0.5 uppercase tracking-wider">
                                    {statusLabel(focusState)}
                                </span>
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onFocus(null)}
                            aria-label="Clear course focus"
                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835] cursor-pointer"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>

                    {/* Lock reason callout if locked */}
                    {focusState.isLocked && focusState.lockReason && (
                        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/80 p-2 text-[10px] font-bold text-amber-900 flex items-start gap-1.5">
                            <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                            <span>{focusState.lockReason}</span>
                        </div>
                    )}

                    {/* Prerequisites section (clickable chips that focus that prereq) */}
                    {focusNode.course.prereq && (
                        <div className="mt-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#3b82f6]">
                                Prerequisites (click to view)
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {prerequisiteChips.length === 0 && (
                                    <span className="text-[10px] font-semibold text-[#92604c]">
                                        {focusNode.course.prereq}
                                    </span>
                                )}
                                {prerequisiteChips.map((chip) => (
                                    <button
                                        key={chip.code}
                                        type="button"
                                        onClick={() => graph.nodes.has(chip.code) && handleFocusCourse(chip.code)}
                                        disabled={chip.external}
                                        title={chip.external ? "External requirement" : `Click to focus ${chip.name}`}
                                        className={`rounded-md border px-2 py-1 text-left text-[9px] font-bold transition-all cursor-pointer ${
                                            chip.external
                                                ? "cursor-default border-dashed border-[#dde3ec] bg-[#f8fafc] text-[#92604c]"
                                                : "border-blue-200 bg-blue-50/80 text-blue-900 hover:border-blue-400 hover:bg-blue-100 hover:shadow-xs"
                                        }`}
                                    >
                                        {chip.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Gates / Other requirements */}
                    {focusNode.gates.length > 0 && (
                        <div className="mt-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#5a6472]">
                                Other requirements
                            </p>
                            <ul className="mt-1.5 space-y-1">
                                {focusNode.gates.map((gate) => (
                                    <li key={gate.label} className="text-[10px] font-bold text-[#92604c]">
                                        {gate.label}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Unlocked courses section (clickable chips that focus that unlock) */}
                    {unlockChips.length > 0 && (
                        <div className="mt-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#10b981]">
                                Unlocks (click to view)
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {unlockChips.map((chip) => (
                                    <button
                                        key={chip.code}
                                        type="button"
                                        onClick={() => graph.nodes.has(chip.code) && handleFocusCourse(chip.code)}
                                        title={`Click to focus ${chip.name}`}
                                        className="rounded-md border border-emerald-200 bg-emerald-50/80 px-2 py-1 text-left text-[9px] font-bold text-emerald-900 transition-all hover:border-emerald-400 hover:bg-emerald-100 hover:shadow-xs cursor-pointer"
                                    >
                                        {chip.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3.5 flex items-center justify-between border-t border-[#dde3ec] pt-2.5">
                        <button
                            type="button"
                            onClick={() => onToggleCourse(focusNode.code)}
                            disabled={focusState.isLocked}
                            className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[10px] font-black transition-colors cursor-pointer disabled:cursor-not-allowed ${
                                focusState.isLocked
                                    ? "bg-[#edf1f6] text-[#9aa4b2]"
                                    : focusState.isCompleted
                                    ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"
                                    : "bg-[#edf1f6] text-[#222d32] hover:bg-[#dc4835] hover:text-white"
                            }`}
                        >
                            <CheckCircle2 className="h-3 w-3" />
                            {focusState.isCompleted ? "Mark Incomplete" : "Mark Completed"}
                        </button>
                        {onOpenNotes && (
                            <button
                                type="button"
                                onClick={() => onOpenNotes(focusNode.course)}
                                className="flex items-center gap-1 text-[10px] font-bold text-[#5a6472] hover:text-[#dc4835] cursor-pointer"
                            >
                                <FileText className="h-3 w-3" /> Notes
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default memo(function DependencyMap(props: Readonly<DependencyMapProps>) {
    return (
        <ReactFlowProvider>
            <DependencyMapContent {...props} />
        </ReactFlowProvider>
    );
});
