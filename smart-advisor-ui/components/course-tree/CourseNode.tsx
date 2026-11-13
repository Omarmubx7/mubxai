"use client";

import { memo } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import type { RoadmapCourseInfo } from "@/lib/course-tree/roadmap";
import { RoadmapStatusPill } from "./visuals";

interface CourseNodeProps {
    info: RoadmapCourseInfo;
    isSelected?: boolean;
    onSelect: () => void;
    size?: "small" | "medium" | "large";
}

export const CourseNode = memo(function CourseNode({
    info,
    isSelected = false,
    onSelect,
    size = "medium",
}: Readonly<CourseNodeProps>) {
    const sizeClasses = {
        small: "w-8 h-8 text-[8px]",
        medium: "w-10 h-10 text-[9px]",
        large: "w-12 h-12 text-[10px]",
    };

    const getBorderClass = () => {
        if (info.status === "Completed") return "border-[#0f7a4a]";
        if (info.status === "In Progress") return "border-[#b45309]";
        if (info.status === "Ready Now") return "border-[#0f7a4a]";
        if (info.status === "Ready After Current Term") return "border-[#b45309]";
        if (info.status === "Blocked") return "border-[#64748b]";
        if (info.status === "Planned") return "border-[#7c3aed]";
        return "border-[#cbd5e1]";
    };

    const getFillClass = () => {
        if (info.status === "Completed") return "bg-[#0f7a4a]/10";
        if (info.status === "In Progress") return "bg-[#b45309]/10";
        if (info.status === "Ready Now") return "bg-[#10b981]/5";
        if (info.status === "Ready After Current Term") return "bg-[#fbbf24]/10";
        if (info.status === "Blocked") return "bg-[#f8fafc]";
        if (info.status === "Planned") return "bg-[#7c3aed]/10";
        return "bg-[#f8fafc]";
    };

    const getTextClass = () => {
        if (info.status === "Completed") return "text-[#0f7a4a]";
        if (info.status === "In Progress") return "text-[#b45309]";
        if (info.status === "Ready Now") return "text-[#0f7a4a]";
        if (info.status === "Ready After Current Term") return "text-[#b45309]";
        if (info.status === "Blocked") return "text-[#64748b]";
        if (info.status === "Planned") return "text-[#7c3aed]";
        return "text-[#5a6472]";
    };

    return (
        <div
            onClick={onSelect}
            className={`
                ${sizeClasses[size]} flex items-center justify-center
                rounded-full border-2 font-black cursor-pointer transition-all
                ${getBorderClass()} ${getFillClass()}
                ${isSelected ? "ring-2 ring-[#dc4835] shadow-lg" : "hover:scale-105 opacity-100"}
            `}
            title={`${info.code} — ${info.node.course.name}`}
        >
            {info.code}
        </div>
    );
});

CourseNode.displayName = "CourseNode";

export function CourseNodeWithLabel({
    info,
    isSelected,
    onSelect,
}: {
    info: RoadmapCourseInfo;
    isSelected?: boolean;
    onSelect: () => void;
}) {
    return (
        <div className="flex flex-col items-center gap-1.5">
            <div
                onClick={onSelect}
                className={`
                    flex items-center justify-center
                    w-10 h-10 text-[9px] font-bold
                    rounded-full border-2 cursor-pointer transition-all
                    ${info.status === "Completed" ? "bg-[#0f7a4a]/10 border-[#0f7a4a] text-[#0f7a4a]" : ""}
                    ${info.status === "In Progress" ? "bg-[#fbbf24]/10 border-[#b45309] text-[#b45309]" : ""}
                    ${info.status === "Ready Now" ? "bg-[#dcfce7] border-[#10b981] text-[#15803d]" : ""}
                    ${info.status === "Ready After Current Term" ? "bg-[#fef3c7] border-[#f59e0b] text-[#b45309]" : ""}
                    ${info.status === "Blocked" ? "bg-[#f8fafc] border-[#64748b] text-[#64748b]" : ""}
                    ${info.status === "Planned" ? "bg-[#f0f4ff] border-[#7c3aed] text-[#7c3aed]" : ""}
                `}
            >
                {info.code}
            </div>
            <span className="text-[8px] text-[#5a6472] leading-tight text-center max-w-16 truncate">
                {info.node.course.name}
            </span>
        </div>
    );
}