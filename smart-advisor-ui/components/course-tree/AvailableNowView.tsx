"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, Search, Sparkles, X } from "lucide-react";
import type { CourseGraph } from "@/lib/course-tree/types";
import type { CourseCategory } from "@/lib/course-tree/types";
import { CATEGORY_ORDER } from "@/lib/course-tree/types";
import {
    allPlannedCodes,
    planCredits,
    RECOMMENDED_MAX_CH,
    type PlanWarning,
    type SemesterPlan,
} from "@/lib/course-tree/semester-plan";
import type { RoadmapCourseInfo } from "@/lib/course-tree/roadmap";
import { countByStatus } from "@/lib/course-tree/roadmap";
import { CourseCard } from "./CourseCard";

const CATEGORY_TONE: Record<CourseCategory, string> = {
    "University Requirements": "text-[#7c3aed]",
    "University Elective": "text-[#059669]",
    "College Requirements": "text-[#2563eb]",
    "Department Requirements": "text-[#d97706]",
    "Department Elective": "text-[#db2777]",
};

export interface AvailableNowViewProps {
    roadmap: Map<string, RoadmapCourseInfo>;
    graph: CourseGraph;
    plan: SemesterPlan;
    planWarnings: PlanWarning[];
    onOpenDetail: (code: string) => void;
    onToggleCompleted: (code: string) => void;
    onToggleInProgress: (code: string) => void;
    onPlanToggle: (code: string) => void;
    onOpenPlanner: () => void;
    isMobile: boolean;
}

export default function AvailableNowView({
    roadmap,
    graph,
    plan,
    planWarnings,
    onOpenDetail,
    onToggleCompleted,
    onToggleInProgress,
    onPlanToggle,
    onOpenPlanner,
    isMobile,
}: Readonly<AvailableNowViewProps>) {
    const [query, setQuery] = useState("");

    const available = useMemo(
        () =>
            [...roadmap.values()]
                .filter((info) => info.status === "Ready Now")
                .sort(
                    (a, b) =>
                        b.unlockCodes.length - a.unlockCodes.length ||
                        (a.node.course.level ?? 1) - (b.node.course.level ?? 1) ||
                        a.code.localeCompare(b.code)
                ),
        [roadmap]
    );

    const readyAfterTermCount = useMemo(() => 
        countByStatus(roadmap, "Ready After Current Term"),
        [roadmap]
    );

    const blockedCount = useMemo(() => 
        countByStatus(roadmap, "Blocked"),
        [roadmap]
    );

    const plannedCount = useMemo(() => 
        countByStatus(roadmap, "Planned"),
        [roadmap]
    );

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return available;
        return available.filter(
            (info) =>
                info.code.toLowerCase().includes(needle) ||
                info.node.course.name.toLowerCase().includes(needle)
        );
    }, [available, query]);

    const grouped = useMemo(() => {
        const byCategory = new Map<CourseCategory, RoadmapCourseInfo[]>();
        for (const info of filtered) {
            const list = byCategory.get(info.category) ?? [];
            list.push(info);
            byCategory.set(info.category, list);
        }
        return CATEGORY_ORDER.flatMap((category) => {
            const list = byCategory.get(category);
            return list && list.length > 0 ? [{ category, list }] : [];
        });
    }, [filtered]);

    const plannedCodes = useMemo(() => allPlannedCodes(plan), [plan]);
    const credits = useMemo(() => planCredits(plan, graph), [plan, graph]);
    const plannedCH = credits.fall + credits.spring + credits.summer;
    const topWarnings = planWarnings.slice(0, 3);

    return (
        <div className="space-y-4">
            {/* At-a-glance plan summary */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border-2 border-[#dde3ec] bg-white px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">
                        Selected CH
                    </p>
                    <p className="text-xl font-black text-[#222d32]">
                        {plannedCH}
                        <span className="ml-1 text-[11px] font-bold text-[#92604c]">
                            / {RECOMMENDED_MAX_CH} max
                        </span>
                    </p>
                </div>
                <div className="rounded-xl border-2 border-[#dde3ec] bg-white px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">
                        Ready now
                    </p>
                    <p className="text-xl font-black text-[#0f7a4a]">{available.length}</p>
                </div>
                <div className="rounded-xl border-2 border-[#dde3ec] bg-white px-3 py-2.5">
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">
                        Ready after term
                    </p>
                    <p className="text-xl font-black text-[#b45309]">{readyAfterTermCount}</p>
                </div>
                <div className="rounded-xl border-2 border-[#dde3ec] bg-white px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">
                    Blocked
                </p>
                <p className="text-xl font-black text-[#94a3b8]">{blockedCount}</p>
            </div>
            <div className="rounded-xl border-2 border-[#dde3ec] bg-white px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">
                    Planned courses
                </p>
                <p className="text-xl font-black text-[#222d32]">{plannedCodes.size}</p>
            </div>
            <div className="rounded-xl border-2 border-[#dde3ec] bg-white px-3 py-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">
                    Warnings
                </p>
                <p
                    className={`text-xl font-black ${
                        planWarnings.length > 0 ? "text-[#dc4835]" : "text-[#0f7a4a]"
                    }`}
                >
                    {planWarnings.length}
                </p>
            </div>
        </div>

            {topWarnings.length > 0 && (
                <div className="rounded-xl border-2 border-[#f39c14]/30 bg-[#f39c14]/[0.05] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#b45309]">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Before you plan
                        </p>
                        <button
                            type="button"
                            onClick={onOpenPlanner}
                            className="flex items-center gap-1 rounded-md border border-[#f39c14]/40 bg-white px-2 py-1 text-[9px] font-black text-[#b45309] transition-colors hover:bg-[#f39c14]/10"
                        >
                            <CalendarRange className="h-3 w-3" />
                            Open semester planner
                        </button>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                        {topWarnings.map((warning) => (
                            <li
                                key={warning.id}
                                className={`text-[10px] font-bold ${
                                    warning.severity === "error" ? "text-[#a52f21]" : "text-[#8a5a12]"
                                }`}
                            >
                                • {warning.message}
                            </li>
                        ))}
                    </ul>
                    {planWarnings.length > topWarnings.length && (
                        <p className="mt-1 text-[9px] font-bold text-[#92604c]">
                            {planWarnings.length - topWarnings.length} more warning
                            {planWarnings.length - topWarnings.length > 1 ? "s" : ""} in the planner.
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-black text-[#222d32]">
                        <Sparkles className="h-4 w-4 text-[#2563eb]" />
                        What you can take next
                    </h3>
                    <p className="text-[10px] font-bold text-[#5a6472]">
                        Courses whose prerequisites are completed or in progress.
                    </p>
                </div>
                <div className="relative ml-auto w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5a6472]" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Find an available course…"
                        aria-label="Search available courses"
                        className="w-full rounded-lg border border-[#dde3ec] bg-white py-2 pl-8 pr-8 text-[11px] font-bold text-[#222d32] placeholder:text-[#9aa4b2] focus:border-[#dc4835] focus:outline-none"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            aria-label="Clear search"
                            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5a6472] hover:bg-[#edf1f6] hover:text-[#dc4835]"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-[#dde3ec] bg-white px-6 py-12 text-center">
                    <p className="text-sm font-black text-[#222d32]">
                        {query ? "No available course matches that search" : "No courses are available yet"}
                    </p>
                    <p className="mx-auto mt-1 max-w-sm text-xs font-bold text-[#5a6472]">
                        {query
                            ? "Try a different course name or code."
                            : "Mark the courses you have finished as Completed, or mark your current courses In Progress, and your next options will appear here."}
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {grouped.map(({ category, list }) => (
                        <section key={category} className="space-y-2">
                            <div className="flex items-center gap-2">
                                <h4 className={`text-[10px] font-black uppercase tracking-[0.18em] ${CATEGORY_TONE[category]}`}>
                                    {category}
                                </h4>
                                <span className="rounded-full bg-[#edf1f6] px-2 py-0.5 text-[9px] font-black text-[#5a6472]">
                                    {list.length}
                                </span>
                                <span className="h-px flex-1 bg-[#dde3ec]" />
                            </div>
                            <div
                                className={`grid gap-2.5 ${
                                    isMobile ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-3"
                                }`}
                            >
                                {list.map((info) => (
                                    <CourseCard
                                        key={info.code}
                                        info={info}
                                        isPlanned={plannedCodes.has(info.code)}
                                        onOpen={() => onOpenDetail(info.code)}
                                        onToggleCompleted={() => onToggleCompleted(info.code)}
                                        onToggleInProgress={() => onToggleInProgress(info.code)}
                                        onPlan={() => onPlanToggle(info.code)}
                                    />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )}
        </div>
    );
}
