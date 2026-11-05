"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ChevronsDownUp,
    ChevronsUpDown,
    ListTree,
    Network,
    Search,
    X,
} from "lucide-react";
import type { Course, CourseData, CurriculumRules } from "@/types";
import { safeStorage } from "@/lib/safe-storage";
import { buildCourseGraph } from "@/lib/course-tree/course-graph";
import { buildOutlineModel, layoutDependencyMap } from "@/lib/course-tree/tree-layout";
import type {
    CourseVisualState,
    OutlineYearGroup,
    TreeFilters,
} from "@/lib/course-tree/types";
import OutlineTree from "./OutlineTree";
import DependencyMap from "./DependencyMap";

export type TreeSubMode = "outline" | "map";

const TREE_MODE_KEY = "mubxai-tree-mode";

export interface CourseTreeViewProps {
    data: CourseData;
    majorKey: string;
    majorLabel: string;
    rules?: CurriculumRules;
    completedCourses: Map<string, string>;
    sandboxMode: boolean;
    isMobile: boolean;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onOpenNotes: (course: Course) => void;
}

function readInitialMode(): TreeSubMode {
    if (typeof window === "undefined") return "outline";
    return safeStorage.get(TREE_MODE_KEY) === "map" ? "map" : "outline";
}

function toggleKey(previous: Set<string>, key: string): Set<string> {
    const next = new Set(previous);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
}

export default function CourseTreeView({
    data,
    majorKey,
    majorLabel,
    rules,
    completedCourses,
    sandboxMode,
    isMobile,
    getCourseState,
    onToggleCourse,
    onOpenNotes,
}: Readonly<CourseTreeViewProps>) {
    const [mode, setMode] = useState<TreeSubMode>(readInitialMode);
    const [query, setQuery] = useState("");
    const [showCompleted, setShowCompleted] = useState(true);
    const [focusCode, setFocusCode] = useState<string | null>(null);
    const [collapsedYears, setCollapsedYears] = useState<Set<string>>(new Set());
    const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

    useEffect(() => {
        safeStorage.set(TREE_MODE_KEY, mode);
    }, [mode]);

    const graph = useMemo(() => buildCourseGraph(data, rules), [data, rules]);

    const completedCodes = useMemo(
        () => new Set(completedCourses.keys()),
        [completedCourses]
    );

    const filters = useMemo<TreeFilters>(
        () => ({ query, showCompleted }),
        [query, showCompleted]
    );

    const outline = useMemo(
        () => buildOutlineModel(graph, filters, completedCodes),
        [graph, filters, completedCodes]
    );

    const mapLayout = useMemo(
        () => layoutDependencyMap(graph, { completedCodes, isMobile, filters }),
        [graph, filters, isMobile, completedCodes]
    );

    const filteredCount = useMemo(
        () => outline.reduce((sum, year) => sum + year.totalCourses, 0),
        [outline]
    );

    const completedCount = useMemo(
        () => [...completedCodes].filter((code) => graph.nodes.has(code)).length,
        [completedCodes, graph]
    );

    const toggleYear = useCallback((key: string) => {
        setCollapsedYears((previous) => toggleKey(previous, key));
    }, []);

    const toggleCategory = useCallback((key: string) => {
        setCollapsedCategories((previous) => toggleKey(previous, key));
    }, []);

    const expandAll = useCallback(() => {
        setCollapsedYears(new Set());
        setCollapsedCategories(new Set());
    }, []);

    const collapseAll = useCallback(() => {
        setCollapsedYears(new Set(outline.map((year: OutlineYearGroup) => year.key)));
        setCollapsedCategories(new Set());
    }, [outline]);

    const focusInMap = useCallback((code: string) => {
        setFocusCode(code);
        setMode("map");
    }, []);

    return (
        <div className="space-y-4">
            <div className="rounded-xl border-2 border-[#dde3ec] bg-white p-2.5 sm:p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex p-0.5 bg-[#edf1f6] border border-[#dde3ec] rounded-lg">
                        {([
                            { value: "outline" as const, label: "Outline", icon: <ListTree className="w-3.5 h-3.5" /> },
                            { value: "map" as const, label: "Map", icon: <Network className="w-3.5 h-3.5" /> },
                        ]).map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setMode(option.value)}
                                aria-pressed={mode === option.value}
                                data-testid={`tree-submode-${option.value}`}
                                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-black transition-all sm:text-xs ${
                                    mode === option.value
                                        ? "bg-[#dc4835] text-white shadow-sm shadow-[#dc4835]/25"
                                        : "text-[#5a6472] hover:text-[#dc4835]"
                                }`}
                            >
                                {option.icon}
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative order-4 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1 sm:min-w-[220px]">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5a6472]" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search course or code..."
                            aria-label="Search courses in the tree"
                            className="w-full rounded-lg border border-[#dde3ec] bg-white py-2 pl-8 pr-8 text-[11px] font-bold text-[#222d32] placeholder:text-[#9aa4b2] focus:border-[#dc4835] sm:text-xs"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery("")}
                                aria-label="Clear search"
                                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5a6472] hover:bg-[#edf1f6] hover:text-[#dc4835]"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>

                    {mode === "outline" && (
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={expandAll}
                                title="Expand all years and categories"
                                className="flex items-center gap-1 rounded-lg border border-[#dde3ec] px-2 py-1.5 text-[10px] font-bold text-[#5a6472] transition-colors hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                            >
                                <ChevronsUpDown className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Expand</span>
                            </button>
                            <button
                                type="button"
                                onClick={collapseAll}
                                title="Collapse all years"
                                className="flex items-center gap-1 rounded-lg border border-[#dde3ec] px-2 py-1.5 text-[10px] font-bold text-[#5a6472] transition-colors hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                            >
                                <ChevronsDownUp className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Collapse</span>
                            </button>
                        </div>
                    )}

                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#dde3ec] px-2 py-1.5 text-[10px] font-bold text-[#5a6472]">
                        <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={(event) => setShowCompleted(event.target.checked)}
                            className="h-3.5 w-3.5 accent-[#dc4835]"
                        />
                        Show completed
                    </label>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#dde3ec]/70 pt-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#5a6472]">
                    <span className="text-[#dc4835]">{majorLabel}</span>
                    <span>{filteredCount} courses shown</span>
                    <span>{completedCount} completed</span>
                    <span className="normal-case tracking-normal text-[#92604c]">
                        {sandboxMode ? "Plan mode: courses toggle the what-if plan" : "Prerequisites form a DAG; shared prerequisites are drawn as cross-links"}
                    </span>
                </div>
            </div>

            {mode === "outline" ? (
                <OutlineTree
                    years={outline}
                    query={query}
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
                    graph={graph}
                    layout={mapLayout}
                    filters={filters}
                    focusCode={focusCode}
                    completedCodes={completedCodes}
                    getCourseState={getCourseState}
                    onToggleCourse={onToggleCourse}
                    onFocus={setFocusCode}
                    onOpenNotes={onOpenNotes}
                    isMobile={isMobile}
                />
            )}

            <p className="text-[9px] font-bold text-[#92604c]">
                {majorKey.replaceAll("_", " ")} · {graph.nodes.size} catalog courses ·{" "}
                {graph.edges.length} prerequisite links
                {graph.externalCodes.length > 0 ? ` · ${graph.externalCodes.length} external requirement codes` : ""}
            </p>
        </div>
    );
}
