"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, ListTree, Network, Route } from "lucide-react";
import type { Course } from "@/types";
import type { CourseVisualState, CourseGraph } from "@/lib/course-tree/types";
import { buildOutlineModel } from "@/lib/course-tree/tree-layout";
import {
    computeCriticalPath,
    filterCourseGraph,
    matchesRoadmapFilters,
    ROADMAP_STATUS_ORDER,
    type RoadmapCourseInfo,
    type RoadmapFilterState,
    type RoadmapStatus,
    DEFAULT_ROADMAP_FILTERS,
} from "@/lib/course-tree/roadmap";
import { safeStorage } from "@/lib/safe-storage";
import OutlineTree from "./OutlineTree";
import DependencyMap from "./DependencyMap";
import RoadmapFilters from "./RoadmapFilters";

const FULL_MAP_MODE_KEY = "mubxai-tree-mode";

type MapSubMode = "outline" | "map";

export interface FullCurriculumMapProps {
    graph: CourseGraph;
    roadmap: Map<string, RoadmapCourseInfo>;
    completedCourses: Map<string, string>;
    sandboxMode: boolean;
    isMobile: boolean;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onOpenNotes: (course: Course) => void;
}

export default function FullCurriculumMap({
    graph,
    roadmap,
    completedCourses,
    sandboxMode,
    isMobile,
    getCourseState,
    onToggleCourse,
    onOpenNotes,
}: Readonly<FullCurriculumMapProps>) {
    const [subMode, setSubMode] = useState<MapSubMode>("map");
    const [subModeLoaded, setSubModeLoaded] = useState(false);
    const [filters, setFilters] = useState<RoadmapFilterState>({ ...DEFAULT_ROADMAP_FILTERS });
    const [focusCode, setFocusCode] = useState<string | null>(null);
    const [criticalEnabled, setCriticalEnabled] = useState(false);
    const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    const completedCodes = useMemo(() => new Set(completedCourses.keys()), [completedCourses]);

    useEffect(() => {
        const saved = safeStorage.get(FULL_MAP_MODE_KEY);
        if (saved === "outline" || saved === "map") setSubMode(saved);
        setSubModeLoaded(true);
    }, []);

    useEffect(() => {
        if (!subModeLoaded) return;
        safeStorage.set(FULL_MAP_MODE_KEY, subMode);
    }, [subMode, subModeLoaded]);

    // Search centers a course; it does not hide the rest of the map, so the
    // student can still see the target's prerequisite context.
    const graphFilters = useMemo<RoadmapFilterState>(
        () => ({ ...filters, query: subMode === "outline" ? filters.query : "" }),
        [filters, subMode]
    );

    const filteredGraph = useMemo(
        () => filterCourseGraph(graph, roadmap, graphFilters),
        [graph, roadmap, graphFilters]
    );

    const filteredCount = filteredGraph.nodes.size;
    const totalCount = graph.nodes.size;

    const outline = useMemo(
        () =>
            buildOutlineModel(
                filteredGraph,
                { query: "", showCompleted: true },
                completedCodes
            ),
        [filteredGraph, completedCodes]
    );

    const searchMatches = useMemo(() => {
        const needle = filters.query.trim().toLowerCase();
        if (!needle) return [];
        return [...roadmap.values()]
            .filter((info) => matchesRoadmapFilters(info, graphFilters))
            .filter(
                (info) =>
                    info.code.toLowerCase().includes(needle) ||
                    info.node.course.name.toLowerCase().includes(needle)
            )
            .slice(0, 6);
    }, [filters.query, roadmap, graphFilters]);

    const criticalPath = useMemo(
        () => computeCriticalPath(graph),
        [graph]
    );
    const criticalTargetLabel = criticalPath.target
        ? graph.nodes.get(criticalPath.target)?.course.name ?? criticalPath.target
        : null;

    const activeFilterCount =
        filters.statuses.length +
        filters.categories.length +
        filters.levels.length +
        (filters.credit === "all" ? 0 : 1);

    const hidesCompleted =
        filters.statuses.length > 0 && !filters.statuses.includes("Completed");

    const completedCount = useMemo(() => {
        let count = 0;
        for (const info of roadmap.values()) {
            if (info.status === "Completed") count += 1;
        }
        return count;
    }, [roadmap]);

    const toggleYear = useCallback((key: string) => {
        setCollapsedYears((previous) => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const toggleCategory = useCallback((key: string) => {
        setCollapsedCategories((previous) => {
            const next = new Set(previous);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const expandAll = useCallback(() => {
        setCollapsedYears(new Set());
        setCollapsedCategories(new Set());
    }, []);

    const collapseAll = useCallback(() => {
        setCollapsedYears(new Set(outline.map((year) => year.key)));
        setCollapsedCategories(new Set());
    }, [outline]);

    const focusInMap = useCallback((code: string) => {
        setFocusCode(code);
        setSubMode("map");
    }, []);

    const handlePickSearchMatch = useCallback((code: string) => {
        setFocusCode(code);
        setSubMode("map");
        setFilters((previous) => ({ ...previous, query: "" }));
    }, []);

    const toggleCriticalPath = useCallback(() => {
        const next = !criticalEnabled;
        setCriticalEnabled(next);
        if (next) setSubMode("map");
    }, [criticalEnabled]);

    const toggleHideCompleted = useCallback(() => {
        const nonCompleted = ROADMAP_STATUS_ORDER.filter(
            (status): status is RoadmapStatus => status !== "Completed"
        );

        setFilters((previous) => {
            if (!hidesCompleted) {
                const nextStatuses =
                    previous.statuses.length === 0
                        ? [...nonCompleted]
                        : previous.statuses.filter((status) => status !== "Completed");

                return {
                    ...previous,
                    // Empty statuses mean "all", so never let hiding completed
                    // fall back to showing every status again.
                    statuses: nextStatuses.length > 0 ? nextStatuses : [...nonCompleted],
                };
            }

            const showsEveryNonCompleted =
                previous.statuses.length === nonCompleted.length &&
                nonCompleted.every((status) => previous.statuses.includes(status));

            return {
                ...previous,
                statuses: showsEveryNonCompleted
                    ? []
                    : [...previous.statuses.filter((status) => status !== "Completed"), "Completed"],
            };
        });
    }, [hidesCompleted]);

    return (
        <div className="space-y-3">
            <RoadmapFilters
                filters={filters}
                onChange={setFilters}
                resultCount={filteredCount}
                totalCount={totalCount}
                searchMatches={searchMatches}
                onPickSearchMatch={handlePickSearchMatch}
                criticalPathEnabled={criticalEnabled}
                onToggleCriticalPath={toggleCriticalPath}
                criticalTargetLabel={criticalTargetLabel}
            />

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-[#dde3ec] bg-[#edf1f6] p-0.5">
                    {([
                        { value: "map" as const, label: "Graph", icon: <Network className="h-3.5 w-3.5" /> },
                        { value: "outline" as const, label: "Outline", icon: <ListTree className="h-3.5 w-3.5" /> },
                    ]).map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => setSubMode(option.value)}
                            aria-pressed={subMode === option.value}
                            data-testid={`tree-submode-${option.value}`}
                            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-black transition-colors ${
                                subMode === option.value
                                    ? "bg-white text-[#dc4835] shadow-sm"
                                    : "text-[#5a6472] hover:text-[#222d32]"
                            }`}
                        >
                            {option.icon}
                            {option.label}
                        </button>
                    ))}
                </div>

                <button
                    type="button"
                    onClick={toggleHideCompleted}
                    aria-pressed={hidesCompleted}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${
                        hidesCompleted
                            ? "border-[#0da55a]/40 bg-[#0da55a]/10 text-[#0f7a4a]"
                            : "border-[#dde3ec] text-[#5a6472] hover:border-[#0da55a]/40 hover:text-[#0f7a4a]"
                    }`}
                >
                    {hidesCompleted ? "Show completed" : "Hide completed"}
                    <span className="rounded-full bg-white px-1.5 text-[9px] ring-1 ring-[#dde3ec]">
                        {completedCount}
                    </span>
                </button>

                {activeFilterCount > 0 && (
                    <span className="text-[9px] font-bold text-[#92604c]">
                        {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
                    </span>
                )}

                {subMode === "outline" && (
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="flex items-center gap-1 rounded-lg border border-[#dde3ec] px-2 py-1.5 text-[9px] font-bold text-[#5a6472] hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                        >
                            <ChevronsUpDown className="h-3.5 w-3.5" />
                            Expand
                        </button>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="flex items-center gap-1 rounded-lg border border-[#dde3ec] px-2 py-1.5 text-[9px] font-bold text-[#5a6472] hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                        >
                            <ChevronsDownUp className="h-3.5 w-3.5" />
                            Collapse
                        </button>
                    </div>
                )}

                {criticalEnabled && criticalPath.codes.length > 0 && (
                    <div className="flex w-full items-center gap-2 rounded-lg border border-[#dc4835]/25 bg-[#dc4835]/[0.04] px-2.5 py-1.5 text-[9px] font-bold text-[#a52f21]">
                        <Route className="h-3.5 w-3.5 shrink-0" />
                        <span>
                            Critical path:{" "}
                            <span className="font-black">{criticalPath.codes.length} courses</span> ·{" "}
                            {criticalPath.totalCH} CH toward{" "}
                            <span className="font-black">{criticalTargetLabel}</span>. Highlighted in
                            the graph and legend.
                        </span>
                    </div>
                )}
            </div>

            {filteredCount === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-[#dde3ec] bg-white px-6 py-14 text-center">
                    <p className="text-sm font-black text-[#222d32]">No courses match these filters</p>
                    <p className="mt-1 text-xs font-bold text-[#5a6472]">
                        Clear a filter or search for a different course.
                    </p>
                    <button
                        type="button"
                        onClick={() => setFilters({ ...DEFAULT_ROADMAP_FILTERS })}
                        className="mt-3 rounded-lg border border-[#dde3ec] px-3 py-1.5 text-[10px] font-black text-[#5a6472] hover:border-[#dc4835] hover:text-[#dc4835]"
                    >
                        Reset filters
                    </button>
                </div>
            ) : subMode === "outline" ? (
                <OutlineTree
                    years={outline}
                    query=""
                    collapsedYears={collapsedYears}
                    collapsedCategories={collapsedCategories}
                    onToggleYear={toggleYear}
                    onToggleCategory={toggleCategory}
                    getCourseState={getCourseState}
                    onToggleCourse={onToggleCourse}
                    onOpenNotes={onOpenNotes}
                    onFocus={focusInMap}
                    isMobile={isMobile}
                />
            ) : (
                <DependencyMap
                    graph={filteredGraph}
                    filters={{ query: "", showCompleted: true }}
                    focusCode={focusCode}
                    completedCodes={completedCodes}
                    getCourseState={getCourseState}
                    onToggleCourse={onToggleCourse}
                    onFocus={setFocusCode}
                    onOpenNotes={onOpenNotes}
                    isMobile={isMobile}
                    criticalCodes={criticalEnabled ? criticalPath.set : undefined}
                    initialMapMode="all"
                    compactLabels
                />
            )}

            <p className="text-xs font-bold text-[#92604c]">
                {sandboxMode
                    ? "Plan mode: toggling a course updates the what-if plan."
                    : "Advanced view — all prerequisite links at once. Use the roadmap tabs for a focused, decision-first view."}
            </p>
        </div>
    );
}
