"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Focus, FileText, CheckCircle2 } from "lucide-react";
import type { CourseNodeData } from "@/lib/course-tree/flow-layout";
import { NodeStatusIcon, FrameworkBadge, statusLabel } from "./visuals";
import { useToast } from "@/components/ui/Toast";

// Category border accent tones
const CATEGORY_ACCENT: Record<string, string> = {
    "University Requirements": "border-l-[#7c3aed]",
    "University Elective": "border-l-[#059669]",
    "College Requirements": "border-l-[#2563eb]",
    "Department Requirements": "border-l-[#d97706]",
    "Department Elective": "border-l-[#db2777]",
};

export const FlowCourseNode = memo(function FlowCourseNode({
    data,
}: Readonly<NodeProps<Node<CourseNodeData>>>) {
    const { toast } = useToast();
    const {
        course,
        code,
        level,
        category,
        state,
        direction = "LR",
        isFocused,
        isPrereq,
        isUnlock,
        isDimmed,
        onToggle,
        onFocus,
        onOpenNotes,
    } = data;

    const isTB = direction === "TB";
    const accentBorder = CATEGORY_ACCENT[category] ?? "border-l-[#5a6472]";

    // Dynamic focus/highlight classes
    let highlightClass = "border-[#dde3ec] bg-white hover:border-[#bec7d4] hover:shadow-md hover:-translate-y-0.5";
    if (isFocused) {
        highlightClass = "border-[#dc4835] ring-2 ring-[#dc4835] shadow-lg bg-white scale-[1.03]";
    } else if (isPrereq) {
        highlightClass = "border-blue-500 ring-2 ring-blue-400/80 shadow-md bg-blue-50/40";
    } else if (isUnlock) {
        highlightClass = "border-emerald-500 ring-2 ring-emerald-400/80 shadow-md bg-emerald-50/40";
    } else if (state.isCompleted) {
        highlightClass = "border-[#0da55a]/40 bg-[#0da55a]/6 hover:border-[#0da55a]";
    } else if (state.isSandboxSelected) {
        highlightClass = "border-[#f39c14]/60 bg-[#f39c14]/12 hover:border-[#f39c14]";
    } else if (state.isInProgress) {
        highlightClass = "border-[#f39c14]/40 bg-[#f39c14]/6";
    } else if (state.isLocked) {
        highlightClass = "border-[#dde3ec] bg-[#f8fafc] opacity-80 hover:opacity-100 hover:border-[#bec7d4]";
    }

    if (isDimmed) {
        highlightClass += " opacity-25 grayscale-[35%]";
    }

    const handleCardClick = () => {
        onFocus(code);
    };

    const handleToggleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (state.isLocked) {
            toast(
                state.lockReason || "Complete prerequisite courses first to unlock this course",
                "info"
            );
            onFocus(code);
        } else {
            onToggle(code);
        }
    };

    const targetPosition = isTB ? Position.Top : Position.Left;
    const sourcePosition = isTB ? Position.Bottom : Position.Right;

    return (
        <div
            data-testid="map-node"
            data-code={code}
            role="button"
            tabIndex={0}
            onClick={handleCardClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onFocus(code);
                }
            }}
            aria-label={`${course.name} (${code}) — ${statusLabel(state)}. Click to inspect and trace prerequisites.`}
            title={state.lockReason ?? `${course.name} (${code}) — ${statusLabel(state)}. Click to inspect.`}
            className={`group relative rounded-xl border border-l-4 p-2 transition-all duration-200 select-none cursor-pointer nodrag ${accentBorder} ${highlightClass}`}
            style={{ width: isTB ? 172 : 204, minHeight: isTB ? 70 : 80 }}
        >
            {/* Input handle for incoming prerequisites */}
            <Handle
                type="target"
                position={targetPosition}
                className={`!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-[#5a6472] transition-colors group-hover:!bg-[#dc4835] ${
                    isTB ? "!-top-1.5 !left-1/2 !-translate-x-1/2" : "!-left-1.5 !top-1/2 !-translate-y-1/2"
                }`}
            />

            <div className="relative z-10 flex flex-col justify-between gap-1">
                {/* Header row: Status toggle button + Code + Badges + Focus button */}
                <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                        {/* Interactive status toggle button */}
                        <button
                            type="button"
                            onClick={handleToggleClick}
                            title={
                                state.isLocked
                                    ? state.lockReason || "Locked: Click to view prerequisites"
                                    : state.isCompleted
                                    ? "Completed: Click to unmark"
                                    : "Click to mark completed"
                            }
                            aria-label={`Toggle completion for ${course.name}`}
                            className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-115 active:scale-95 cursor-pointer"
                        >
                            <NodeStatusIcon state={state} className="h-3.5 w-3.5" />
                        </button>

                        <span className="font-mono text-[9.5px] font-black tracking-wider text-[#92604c]">
                            {code}
                        </span>
                        <span className="rounded bg-[#edf1f6] px-1 py-0.2 text-[7.5px] font-black text-[#5a6472]">
                            Y{level}
                        </span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                        <FrameworkBadge framework={course.framework} />
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFocus(code);
                            }}
                            title={isFocused ? "Clear focus" : "Inspect and highlight prerequisite chain"}
                            aria-label={`Focus ${course.name}`}
                            className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border text-[#5a6472] transition-all hover:border-[#dc4835] hover:bg-white hover:text-[#dc4835] cursor-pointer ${
                                isFocused
                                    ? "border-[#dc4835] bg-[#dc4835] text-white hover:text-white"
                                    : "border-transparent opacity-60 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                            }`}
                        >
                            <Focus className="h-2.5 w-2.5" />
                        </button>
                    </div>
                </div>

                {/* Course Title */}
                <p
                    data-testid="map-node-name"
                    className="line-clamp-2 text-[11px] font-bold leading-[1.2] text-[#222d32]"
                    title={course.name}
                >
                    {course.name}
                </p>

                {/* Footer row: Credit Hours + Quick Notes trigger / Status text */}
                <div className="flex items-center justify-between text-[8.5px] font-bold text-[#5a6472]">
                    <span className="text-[#92604c]">{course.ch} CH</span>

                    <div className="flex items-center gap-1.5">
                        {state.isCompleted && (
                            <span className="flex items-center gap-0.5 text-[8px] font-black text-[#0da55a]">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Done
                            </span>
                        )}
                        {onOpenNotes && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenNotes(course);
                                }}
                                title="Open notes"
                                aria-label={`Open notes for ${course.name}`}
                                className="flex h-4 w-4 items-center justify-center rounded text-[#9aa4b2] hover:text-[#dc4835] cursor-pointer"
                            >
                                <FileText className="h-2.5 w-2.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Output handle for outgoing prerequisite unlocks */}
            <Handle
                type="source"
                position={sourcePosition}
                className={`!h-2.5 !w-2.5 !rounded-full !border-2 !border-white !bg-[#5a6472] transition-colors group-hover:!bg-[#dc4835] ${
                    isTB ? "!-bottom-1.5 !left-1/2 !-translate-x-1/2" : "!-right-1.5 !top-1/2 !-translate-y-1/2"
                }`}
            />
        </div>
    );
});
