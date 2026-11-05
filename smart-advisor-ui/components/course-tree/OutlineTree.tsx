"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    BookOpen,
    ChevronDown,
    ChevronRight,
    Focus,
    GraduationCap,
    Sparkles,
    Star,
    Target,
    Trophy,
} from "lucide-react";
import type { Course } from "@/types";
import type {
    CourseCategory,
    CourseVisualState,
    OutlineCategoryGroup,
    OutlineYearGroup,
} from "@/lib/course-tree/types";
import { NodeStatusIcon, FrameworkBadge, nodeTone, statusLabel } from "./visuals";

const LEVEL_THEME: Record<number, { color: string; bg: string; border: string }> = {
    1: { color: "#dc4835", bg: "rgba(220,72,53,0.06)", border: "rgba(220,72,53,0.22)" },
    2: { color: "#ea580c", bg: "rgba(234,88,12,0.06)", border: "rgba(234,88,12,0.22)" },
    3: { color: "#ca8a04", bg: "rgba(202,138,4,0.06)", border: "rgba(202,138,4,0.22)" },
    4: { color: "#16a34a", bg: "rgba(22,163,74,0.06)", border: "rgba(22,163,74,0.22)" },
    5: { color: "#7c3aed", bg: "rgba(124,58,237,0.06)", border: "rgba(124,58,237,0.22)" },
};

const CATEGORY_THEME: Record<CourseCategory, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
    "University Requirements": {
        color: "#7c3aed",
        bg: "rgba(124,58,237,0.07)",
        border: "rgba(124,58,237,0.22)",
        icon: <GraduationCap className="w-3.5 h-3.5" />,
    },
    "University Elective": {
        color: "#059669",
        bg: "rgba(5,150,105,0.07)",
        border: "rgba(5,150,105,0.22)",
        icon: <Star className="w-3.5 h-3.5" />,
    },
    "College Requirements": {
        color: "#2563eb",
        bg: "rgba(37,99,235,0.07)",
        border: "rgba(37,99,235,0.22)",
        icon: <BookOpen className="w-3.5 h-3.5" />,
    },
    "Department Requirements": {
        color: "#d97706",
        bg: "rgba(217,119,6,0.07)",
        border: "rgba(217,119,6,0.22)",
        icon: <Target className="w-3.5 h-3.5" />,
    },
    "Department Elective": {
        color: "#db2777",
        bg: "rgba(219,39,119,0.07)",
        border: "rgba(219,39,119,0.22)",
        icon: <Star className="w-3.5 h-3.5" />,
    },
};

function percent(done: number, total: number): number {
    if (total <= 0) return 0;
    return Math.min(100, Math.round((done / total) * 100));
}

interface OutlineTreeProps {
    years: OutlineYearGroup[];
    query: string;
    collapsedYears: Set<string>;
    collapsedCategories: Set<string>;
    onToggleYear: (key: string) => void;
    onToggleCategory: (key: string) => void;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onOpenNotes: (course: Course) => void;
    onFocus: (code: string) => void;
    isMobile: boolean;
}

function categoryKey(yearKey: string, category: CourseCategory): string {
    return `${yearKey}:${category}`;
}

export default function OutlineTree({
    years,
    query,
    collapsedYears,
    collapsedCategories,
    onToggleYear,
    onToggleCategory,
    getCourseState,
    onToggleCourse,
    onOpenNotes,
    onFocus,
    isMobile,
}: Readonly<OutlineTreeProps>) {
    if (years.length === 0) {
        return (
            <div className="rounded-xl border-2 border-dashed border-[#dde3ec] bg-white px-6 py-14 text-center">
                <p className="text-sm font-black text-[#222d32]">No courses match this filter</p>
                <p className="mt-1 text-xs font-bold text-[#5a6472]">
                    {query ? "Try a different course name or code." : "Mark some courses or show completed courses."}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {years.map((year) => {
                const theme = LEVEL_THEME[year.level] ?? LEVEL_THEME[1];
                const collapsed = !query && collapsedYears.has(year.key);
                const pct = percent(year.completedCH, year.totalCH);

                return (
                    <section
                        key={year.key}
                        data-testid="tree-year"
                        data-level={year.level}
                        className="overflow-hidden rounded-xl border-2 bg-white"
                        style={{ borderColor: theme.border }}
                    >
                        <button
                            type="button"
                            aria-expanded={!collapsed}
                            onClick={() => onToggleYear(year.key)}
                            className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-[#edf1f6]/60 sm:px-5 sm:py-4"
                        >
                            <span className="shrink-0" style={{ color: theme.color }}>
                                {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </span>
                            <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10"
                                style={{ background: theme.bg, color: theme.color }}
                            >
                                <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <span className="text-sm font-black text-[#222d32] sm:text-base">{year.label}</span>
                                    <span
                                        className="rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.14em]"
                                        style={{ background: theme.bg, color: theme.color }}
                                    >
                                        {year.completedCourses}/{year.totalCourses} courses
                                    </span>
                                </span>
                                <span className="mt-1.5 block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[#dde3ec]">
                                    <span
                                        className="block h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, background: theme.color }}
                                    />
                                </span>
                            </span>
                            <span className="shrink-0 text-right">
                                <span className="block text-[11px] font-black text-[#222d32] sm:text-xs">
                                    {year.completedCH}/{year.totalCH} CH
                                </span>
                                <span className="block text-[10px] font-bold text-[#5a6472]">{pct}%</span>
                            </span>
                        </button>

                        <AnimatePresence initial={false}>
                            {!collapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                    className="overflow-hidden"
                                >
                                    <div className="space-y-2 border-t border-[#dde3ec]/80 px-2 pb-3 pt-2 sm:px-4 sm:pb-4">
                                        {year.categories.map((category) => (
                                            <CategoryBranch
                                                key={category.label}
                                                year={year}
                                                category={category}
                                                collapsed={!query && collapsedCategories.has(categoryKey(year.key, category.label))}
                                                onToggle={() => onToggleCategory(categoryKey(year.key, category.label))}
                                                getCourseState={getCourseState}
                                                onToggleCourse={onToggleCourse}
                                                onOpenNotes={onOpenNotes}
                                                onFocus={onFocus}
                                                isMobile={isMobile}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </section>
                );
            })}
        </div>
    );
}

interface CategoryBranchProps {
    year: OutlineYearGroup;
    category: OutlineCategoryGroup;
    collapsed: boolean;
    onToggle: () => void;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onOpenNotes: (course: Course) => void;
    onFocus: (code: string) => void;
    isMobile: boolean;
}

function CategoryBranch({
    category,
    collapsed,
    onToggle,
    getCourseState,
    onToggleCourse,
    onOpenNotes,
    onFocus,
    isMobile,
}: Readonly<CategoryBranchProps>) {
    const theme = CATEGORY_THEME[category.label] ?? CATEGORY_THEME["Department Requirements"];
    const pct = percent(category.completedCH, category.totalCH);

    return (
        <div
            data-testid="tree-category"
            className="rounded-lg border"
            style={{ borderColor: theme.border, background: theme.bg }}
        >
            <button
                type="button"
                aria-expanded={!collapsed}
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left sm:px-3"
            >
                <span className="shrink-0" style={{ color: theme.color }}>
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
                <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    style={{ background: "rgba(255,255,255,0.7)", color: theme.color }}
                >
                    {theme.icon}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: theme.color }}>
                        {category.label}
                    </span>
                </span>
                <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-white/70 sm:block">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: theme.color }} />
                </span>
                <span className="shrink-0 text-[10px] font-bold text-[#5a6472]">
                    {category.completedCourses}/{category.totalCourses}
                </span>
            </button>

            <AnimatePresence initial={false}>
                {!collapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="space-y-1.5 px-2 pb-2 sm:px-3">
                            {category.courses.map(({ node }) => {
                                const state = getCourseState(node.course);
                                const blocked = state.isLocked || state.isDimmed;
                                return (
                                    <div
                                        key={node.code}
                                        data-testid="tree-course"
                                        data-code={node.code}
                                        className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all duration-200 ${nodeTone(state)}`}
                                        style={{ marginLeft: isMobile ? 8 : 16 }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => !blocked && onToggleCourse(node.code)}
                                            disabled={blocked}
                                            aria-label={`${statusLabel(state)}: ${node.course.name}. Click to ${state.isCompleted ? "unmark" : "mark"} completed`}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dde3ec] bg-white/80 transition-colors hover:border-[#dc4835]/40 disabled:cursor-not-allowed"
                                            title={state.lockReason ?? statusLabel(state)}
                                        >
                                            <NodeStatusIcon state={state} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => !blocked && onToggleCourse(node.code)}
                                            disabled={blocked}
                                            className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
                                            title={node.course.prereq ? `Prerequisite: ${node.course.prereq}` : "No prerequisite"}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <span className="truncate text-[12px] font-bold text-[#222d32] sm:text-[13px]">
                                                    {node.course.name}
                                                </span>
                                            </span>
                                            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] font-bold text-[#5a6472] sm:text-[10px]">
                                                <span className="font-mono tracking-wider text-[#92604c]">{node.code}</span>
                                                <FrameworkBadge framework={node.course.framework} />
                                                <span>{node.course.ch} CH</span>
                                                {state.lockReason && (
                                                    <span className="max-w-[16rem] truncate font-sans text-[#dc4835]/80">
                                                        {state.lockReason}
                                                    </span>
                                                )}
                                            </span>
                                        </button>

                                        <span className="hidden shrink-0 items-center gap-1 sm:flex">
                                            <button
                                                type="button"
                                                onClick={() => onFocus(node.code)}
                                                title="Show this course in the prerequisite map"
                                                aria-label={`Show ${node.course.name} in the map`}
                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#5a6472] transition-colors hover:border-[#dde3ec] hover:bg-white hover:text-[#dc4835]"
                                            >
                                                <Focus className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onOpenNotes(node.course)}
                                                title="Open course notes"
                                                aria-label={`Open notes for ${node.course.name}`}
                                                className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-[#5a6472] transition-colors hover:border-[#dde3ec] hover:bg-white hover:text-[#dc4835]"
                                            >
                                                <Sparkles className="w-3.5 h-3.5" />
                                            </button>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
