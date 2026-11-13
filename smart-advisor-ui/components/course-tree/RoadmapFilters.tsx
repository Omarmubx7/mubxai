"use client";

import { useState } from "react";
import { ChevronDown, Filter, Route, Search, X } from "lucide-react";
import type { CourseCategory } from "@/lib/course-tree/types";
import { CATEGORY_ORDER } from "@/lib/course-tree/types";
import {
    CREDIT_FILTER_OPTIONS,
    DEFAULT_ROADMAP_FILTERS,
    ROADMAP_STATUS_ORDER,
    type RoadmapCourseInfo,
    type RoadmapFilterState,
    type RoadmapStatus,
} from "@/lib/course-tree/roadmap";
import { ROADMAP_STATUS_THEME } from "./visuals";

const CATEGORY_LABEL: Record<CourseCategory, string> = {
    "University Requirements": "University Req.",
    "University Elective": "University Elective",
    "College Requirements": "College Req.",
    "Department Requirements": "Department Req.",
    "Department Elective": "Department Elective",
};

const LEVELS = [1, 2, 3, 4, 5];

export interface RoadmapFiltersProps {
    filters: RoadmapFilterState;
    onChange: (filters: RoadmapFilterState) => void;
    resultCount: number;
    totalCount: number;
    searchMatches: RoadmapCourseInfo[];
    onPickSearchMatch: (code: string) => void;
    criticalPathEnabled: boolean;
    onToggleCriticalPath: () => void;
    criticalTargetLabel?: string | null;
}

function toggleValue<T>(values: T[], value: T): T[] {
    return values.includes(value)
        ? values.filter((entry) => entry !== value)
        : [...values, value];
}

export default function RoadmapFilters({
    filters,
    onChange,
    resultCount,
    totalCount,
    searchMatches,
    onPickSearchMatch,
    criticalPathEnabled,
    onToggleCriticalPath,
    criticalTargetLabel,
}: Readonly<RoadmapFiltersProps>) {
    const [expanded, setExpanded] = useState(false);

    const activeFilterCount =
        filters.statuses.length +
        filters.categories.length +
        filters.levels.length +
        (filters.credit === "all" ? 0 : 1);

    const hasFilters = activeFilterCount > 0 || filters.query.length > 0;

    return (
        <div className="rounded-xl border-2 border-[#dde3ec] bg-white p-2.5 sm:p-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative order-2 w-full min-w-0 sm:order-none sm:w-auto sm:flex-1 sm:min-w-[220px]">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5a6472]" />
                    <input
                        type="search"
                        value={filters.query}
                        onChange={(event) => onChange({ ...filters, query: event.target.value })}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && searchMatches[0]) {
                                event.preventDefault();
                                onPickSearchMatch(searchMatches[0].code);
                            }
                        }}
                        placeholder="Find a course to center on the map…"
                        aria-label="Search courses in the tree"
                        className="w-full rounded-lg border border-[#dde3ec] bg-white py-2 pl-8 pr-8 text-[11px] font-bold text-[#222d32] placeholder:text-[#9aa4b2] focus:border-[#dc4835] focus:outline-none"
                    />
                    {filters.query && (
                        <button
                            type="button"
                            onClick={() => onChange({ ...filters, query: "" })}
                            aria-label="Clear search"
                            className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#5a6472] hover:bg-[#edf1f6] hover:text-[#dc4835]"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    )}

                    {filters.query.trim() && searchMatches.length > 0 && (
                        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#dde3ec] bg-white p-1 shadow-lg">
                            {searchMatches.map((info) => (
                                <li key={info.code}>
                                    <button
                                        type="button"
                                        onClick={() => onPickSearchMatch(info.code)}
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[#edf1f6]"
                                    >
                                        <span className="font-mono text-[9px] font-black text-[#92604c]">
                                            {info.code}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#222d32]">
                                            {info.node.course.name}
                                        </span>
                                        <span
                                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                                            style={{ background: ROADMAP_STATUS_THEME[info.status].dot }}
                                        />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-expanded={expanded}
                    className="flex items-center gap-1.5 rounded-lg border border-[#dde3ec] px-2.5 py-1.5 text-[10px] font-black text-[#5a6472] transition-colors hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                >
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="rounded-full bg-[#dc4835] px-1.5 text-[9px] font-black text-white">
                            {activeFilterCount}
                        </span>
                    )}
                    <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>

                <button
                    type="button"
                    onClick={onToggleCriticalPath}
                    aria-pressed={criticalPathEnabled}
                    title={
                        criticalTargetLabel
                            ? `Highlight the longest prerequisite chain toward ${criticalTargetLabel}`
                            : "Highlight the longest prerequisite chain toward graduation"
                    }
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${
                        criticalPathEnabled
                            ? "border-[#dc4835] bg-[#dc4835] text-white"
                            : "border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835]/50 hover:text-[#dc4835]"
                    }`}
                >
                    <Route className="h-3.5 w-3.5" />
                    Critical path
                </button>

                <span className="ml-auto text-[9px] font-bold text-[#92604c]">
                    {resultCount} of {totalCount} courses
                </span>
            </div>

            {expanded && (
                <div className="mt-2.5 space-y-2 border-t border-[#dde3ec]/70 pt-2.5">
                    <FilterRow label="Status">
                        {ROADMAP_STATUS_ORDER.map((status) => (
                            <Chip
                                key={status}
                                active={filters.statuses.includes(status)}
                                onClick={() =>
                                    onChange({
                                        ...filters,
                                        statuses: toggleValue<RoadmapStatus>(filters.statuses, status),
                                    })
                                }
                            >
                                <span
                                    className="h-1.5 w-1.5 rounded-full"
                                    style={{ background: ROADMAP_STATUS_THEME[status].dot }}
                                />
                                {status}
                            </Chip>
                        ))}
                    </FilterRow>

                    <FilterRow label="Category">
                        {CATEGORY_ORDER.map((category) => (
                            <Chip
                                key={category}
                                active={filters.categories.includes(category)}
                                onClick={() =>
                                    onChange({
                                        ...filters,
                                        categories: toggleValue<CourseCategory>(
                                            filters.categories,
                                            category
                                        ),
                                    })
                                }
                            >
                                {CATEGORY_LABEL[category]}
                            </Chip>
                        ))}
                    </FilterRow>

                    <FilterRow label="Year">
                        {LEVELS.map((level) => (
                            <Chip
                                key={level}
                                active={filters.levels.includes(level)}
                                onClick={() =>
                                    onChange({
                                        ...filters,
                                        levels: toggleValue<number>(filters.levels, level),
                                    })
                                }
                            >
                                Y{level}
                            </Chip>
                        ))}
                    </FilterRow>

                    <FilterRow label="Credit hours">
                        {CREDIT_FILTER_OPTIONS.map((option) => (
                            <Chip
                                key={option.value}
                                active={filters.credit === option.value}
                                onClick={() => onChange({ ...filters, credit: option.value })}
                            >
                                {option.label}
                            </Chip>
                        ))}
                    </FilterRow>

                    {hasFilters && (
                        <button
                            type="button"
                            onClick={() => onChange({ ...DEFAULT_ROADMAP_FILTERS })}
                            className="flex items-center gap-1 rounded-md border border-[#dde3ec] px-2 py-1 text-[9px] font-black text-[#5a6472] transition-colors hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                        >
                            <X className="h-3 w-3" />
                            Clear all filters
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function FilterRow({
    label,
    children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
    return (
        <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-[9px] font-black uppercase tracking-[0.14em] text-[#9aa4b2]">
                {label}
            </span>
            {children}
        </div>
    );
}

function Chip({
    active,
    onClick,
    children,
}: Readonly<{ active: boolean; onClick: () => void; children: React.ReactNode }>) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black transition-colors ${
                active
                    ? "border-[#dc4835]/45 bg-[#dc4835]/10 text-[#dc4835]"
                    : "border-[#dde3ec] text-[#5a6472] hover:border-[#bec7d4] hover:text-[#222d32]"
            }`}
        >
            {children}
        </button>
    );
}
