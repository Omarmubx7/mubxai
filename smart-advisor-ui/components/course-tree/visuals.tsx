"use client";

import { AlertCircle, CheckCircle2, Circle, Lock, Target } from "lucide-react";
import type { CourseVisualState } from "@/lib/course-tree/types";

const FRAMEWORK_STYLE: Record<string, string> = {
    HTU: "text-[#c249a8] border-[#c249a8]/20 bg-[#c249a8]/5",
    HNC: "text-[#0da55a] border-[#0da55a]/20 bg-[#0da55a]/5",
    HND: "text-[#43aad7] border-[#43aad7]/20 bg-[#43aad7]/5",
};

export function frameworkClass(framework: string | undefined): string {
    return FRAMEWORK_STYLE[framework ?? ""] ?? "text-[#5a6472] border-[#dde3ec] bg-[#edf1f6]";
}

export function NodeStatusIcon({
    state,
    className = "w-4 h-4",
}: Readonly<{ state: CourseVisualState; className?: string }>) {
    if (state.isSandboxSelected) {
        return <Target className={className} style={{ color: "#f39c14" }} aria-hidden />;
    }
    if (state.isCompleted) {
        return <CheckCircle2 className={className} style={{ color: "#0da55a" }} aria-hidden />;
    }
    if (state.isInProgress) {
        return (
            <Circle
                className={className}
                style={{ fill: "rgba(243,156,20,0.2)", color: "#f39c14" }}
                aria-hidden
            />
        );
    }
    if (state.isLocked) {
        return <Lock className={`${className} text-[#b4becb]`} aria-hidden />;
    }
    if (state.hasPrereqWarning) {
        return <AlertCircle className={className} style={{ color: "#f39c14", opacity: 0.8 }} aria-hidden />;
    }
    return <Circle className={`${className} text-[#c8d1dd]`} aria-hidden />;
}

export function statusLabel(state: CourseVisualState): string {
    if (state.isSandboxSelected) return "Selected in plan";
    if (state.isCompleted) return "Completed";
    if (state.isInProgress) return "In progress";
    if (state.isLocked) return "Locked";
    if (state.hasPrereqWarning) return "Prerequisite warning";
    return "Available";
}

export function nodeTone(state: CourseVisualState): string {
    if (state.isSandboxSelected) {
        return "border-[#f39c14]/60 bg-[#f39c14]/10 hover:border-[#f39c14]";
    }
    if (state.isCompleted) {
        return "border-[#0da55a]/40 bg-[#0da55a]/8 hover:border-[#0da55a]/70";
    }
    if (state.isInProgress) {
        return "border-[#f39c14]/50 bg-[#f39c14]/10 hover:border-[#f39c14]/80";
    }
    if (state.isDimmed) {
        return "border-[#dde3ec] bg-white opacity-40";
    }
    if (state.isLocked) {
        return "border-[#dde3ec] bg-[#f8fafc] opacity-65 hover:opacity-90";
    }
    if (state.hasPrereqWarning) {
        return "border-[#f39c14]/40 bg-[#f39c14]/5 hover:border-[#f39c14]/70";
    }
    return "border-[#dde3ec] bg-white hover:border-[#bec7d4]";
}

export const ROADMAP_STATUS_THEME: Record<string, { card: string; dot: string; text: string }> = {
    completed: { card: "bg-[#0da55a]/10 border-[#0da55a]/20", dot: "#0da55a", text: "#0da55a" },
    "in-progress": { card: "bg-[#f39c14]/10 border-[#f39c14]/20", dot: "#f39c14", text: "#f39c14" },
    locked: { card: "bg-[#b4becb]/10 border-[#b4becb]/20", dot: "#b4becb", text: "#b4becb" },
    available: { card: "bg-[#c8d1dd]/10 border-[#c8d1dd]/20", dot: "#c8d1dd", text: "#c8d1dd" },
    planned: { card: "bg-[#f39c14]/10 border-[#f39c14]/20", dot: "#f39c14", text: "#f39c14" },
    "prereq-warning": { card: "bg-[#f39c14]/10 border-[#f39c14]/20", dot: "#f39c14", text: "#f39c14" },
    default: { card: "bg-[#edf1f6] border-[#dde3ec]", dot: "#c8d1dd", text: "#5a6472" },
};

export function RoadmapStatusPill({
    status,
    className = "",
}: Readonly<{ status: string; className?: string }>) {
    const theme = ROADMAP_STATUS_THEME[status] || ROADMAP_STATUS_THEME.default;
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${theme.card} ${className}`}
        >
            <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ background: theme.dot }} aria-hidden />
            {status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, " ")}
        </span>
    );
}

export function FrameworkBadge({
    framework,
    className = "",
}: Readonly<{ framework: string | undefined; className?: string }>) {
    if (!framework) return null;
    return (
        <span
            className={`inline-flex items-center rounded border px-1 py-px text-[8px] font-black tracking-[0.12em] ${frameworkClass(framework)} ${className}`}
        >
            {framework}
        </span>
    );
}
