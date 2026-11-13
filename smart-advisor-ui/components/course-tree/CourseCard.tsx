"use client";

import { memo } from "react";
import { CheckCircle2, ChevronRight, PlayCircle, Plus } from "lucide-react";
import type { RoadmapCourseInfo } from "@/lib/course-tree/roadmap";
import { RoadmapStatusPill, ROADMAP_STATUS_THEME, FrameworkBadge } from "./visuals";

export interface CourseCardProps {
    info: RoadmapCourseInfo;
    isPlanned: boolean;
    onOpen: () => void;
    onToggleCompleted: () => void;
    onToggleInProgress: () => void;
    onPlan: () => void;
}

function stop(event: React.SyntheticEvent) {
    event.stopPropagation();
}

/**
 * Decision-focused course card: what it needs, what it unlocks, and the three
 * status actions. The whole card opens the detail drawer.
 */
export const CourseCard = memo(function CourseCard({
    info,
    isPlanned,
    onOpen,
    onToggleCompleted,
    onToggleInProgress,
    onPlan,
}: Readonly<CourseCardProps>) {
    const course = info.node.course;
    const theme = ROADMAP_STATUS_THEME[info.status];
    const isCompleted = info.status === "Completed";
    const isInProgress = info.status === "In Progress";

    return (
        <div
            role="button"
            tabIndex={0}
            data-testid="roadmap-course-card"
            data-code={info.code}
            data-status={info.status}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
            aria-label={`${course.name} (${info.code}), ${info.status}. Open details.`}
            className={`group relative flex h-full cursor-pointer flex-col rounded-xl border-2 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(34,45,50,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dc4835] focus-visible:ring-offset-1 ${theme.card}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="font-mono text-[10px] font-black tracking-[0.14em] text-[#92604c]">
                        {info.code}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[13px] font-black leading-tight text-[#222d32]">
                        {course.name}
                    </p>
                </div>
                <RoadmapStatusPill status={info.status} className="shrink-0" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-[#5a6472]">
                <span className="rounded bg-white/80 px-1.5 py-0.5 ring-1 ring-[#dde3ec]">
                    {course.ch} CH
                </span>
                <span className="rounded bg-white/80 px-1.5 py-0.5 ring-1 ring-[#dde3ec]">
                    {info.category}
                </span>
                <FrameworkBadge framework={course.framework} />
                {isPlanned && (
                    <span className="rounded border border-[#f39c14]/40 bg-[#f39c14]/10 px-1.5 py-0.5 font-black text-[#b45309]">
                        In plan
                    </span>
                )}
            </div>

            <dl className="mt-2.5 space-y-1 text-[10px] font-bold leading-snug">
                <div className="flex gap-1.5">
                    <dt className="shrink-0 text-[#2563eb]">Opens:</dt>
                    <dd
                        className="truncate text-[#5a6472]"
                        title={info.unlockCodes.join(", ") || "Nothing directly"}
                    >
                        {info.unlockSummary || "Required for graduation"}
                    </dd>
                </div>
                {info.status === "Blocked" && info.missingPrereqs.length > 0 && (
                    <div className="flex gap-1.5">
                        <dt className="shrink-0 text-[#dc4835]/80">Missing:</dt>
                        <dd className="truncate text-[#dc4835]/80" title={info.missingPrereqs.join(", ")}>
                            {info.missingPrereqs.join(", ")}
                        </dd>
                    </div>
                )}
                {info.status === "Ready After Current Term" && info.inProgressPrereqs.length > 0 && (
                    <div className="flex gap-1.5">
                        <dt className="shrink-0 text-[#f59e0b]">Requires:</dt>
                        <dd className="truncate text-[#b45309]" title={info.inProgressPrereqs.join(", ")}>
                            {info.inProgressPrereqs.map(code => {
                                const node = info.node.course.name;
                                return `${code} — in progress`;
                            }).join("; ")}
                        </dd>
                    </div>
                )}
                {info.status === "Ready Now" && info.prereqCodes.length > 0 && (
                    <div className="flex gap-1.5">
                        <dt className="shrink-0 text-[#0f7a4a]">Prerequisites:</dt>
                        <dd className="truncate text-[#5a6472]" title={info.prereqCodes.join(", ")}>
                            {info.prereqSummary || "Completed"}
                        </dd>
                    </div>
                )}
            </dl>

            <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[#dde3ec]/70 pt-2.5">
                <button
                    type="button"
                    onClick={(event) => {
                        stop(event);
                        onToggleCompleted();
                    }}
                    aria-pressed={isCompleted}
                    title={isCompleted ? "Mark as not completed" : "Mark this course completed"}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black transition-colors ${
                        isCompleted
                            ? "border-[#0da55a]/40 bg-[#0da55a]/12 text-[#0f7a4a] hover:bg-[#0da55a]/20"
                            : "border-[#dde3ec] text-[#5a6472] hover:border-[#0da55a]/50 hover:text-[#0f7a4a]"
                    }`}
                >
                    <CheckCircle2 className="h-3 w-3" />
                    {isCompleted ? "Completed" : "Complete"}
                </button>

                <button
                    type="button"
                    onClick={(event) => {
                        stop(event);
                        onToggleInProgress();
                    }}
                    aria-pressed={isInProgress}
                    title={isInProgress ? "Remove in-progress mark" : "Mark this course in progress"}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black transition-colors ${
                        isInProgress
                            ? "border-[#f39c14]/45 bg-[#f39c14]/12 text-[#b45309] hover:bg-[#f39c14]/20"
                            : "border-[#dde3ec] text-[#5a6472] hover:border-[#f39c14]/50 hover:text-[#b45309]"
                    }`}
                >
                    <PlayCircle className="h-3 w-3" />
                    In progress
                </button>

                <button
                    type="button"
                    onClick={(event) => {
                        stop(event);
                        onPlan();
                    }}
                    aria-pressed={isPlanned}
                    title={isPlanned ? "Remove from semester plan" : "Add to your semester plan"}
                    className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-black transition-colors ${
                        isPlanned
                            ? "border-[#dc4835]/35 bg-[#dc4835]/8 text-[#dc4835] hover:bg-[#dc4835]/15"
                            : "border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835]/50 hover:text-[#dc4835]"
                    }`}
                >
                    <Plus className="h-3 w-3" />
                    {isPlanned ? "Unplan" : "Plan"}
                </button>

                <span className="ml-auto flex items-center gap-0.5 text-[9px] font-black text-[#9aa4b2] transition-colors group-hover:text-[#dc4835]">
                    Details
                    <ChevronRight className="h-3 w-3" />
                </span>
            </div>
        </div>
    );
});

export default CourseCard;
