"use client";

import { useMemo, useState, useCallback } from "react";
import {
    ReactFlow,
    Background,
    BackgroundVariant,
    Controls,
    type Node,
    type Edge,
    MarkerType,
    useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronRight, BookOpen, Layers, Trophy, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Course } from "@/types";
import type {
    CourseGraph,
    CourseVisualState,
} from "@/lib/course-tree/types";
import { buildFlowGraph } from "@/lib/course-tree/flow-layout";
import type { RoadmapCourseInfo, RoadmapStatus } from "@/lib/course-tree/roadmap";
import { countByStatus, availableNow } from "@/lib/course-tree/roadmap";
import type { SemesterPlan } from "@/lib/course-tree/semester-plan";
import { FlowCourseNode } from "./FlowCourseNode";
import { RoadmapStatusPill } from "./visuals";
import { CourseNode, CourseNodeWithLabel } from "./CourseNode";

const STATUS_COLORS: Record<RoadmapStatus, string> = {
    "Completed": "#0f7a4a",
    "In Progress": "#b45309",
    "Ready Now": "#10b981",
    "Ready After Current Term": "#f59e0b",
    "Blocked": "#64748b",
    "Planned": "#7c3aed",
};

const nodeTypes = {
    courseNode: FlowCourseNode,
    circularNode: ({ data }: { data: { info: RoadmapCourseInfo; isSelected: boolean } }) => (
        <CircularCourseNode 
            info={data.info} 
            isSelected={data.isSelected} 
        />
    ),
};

interface CircularCourseNodeProps {
    info: RoadmapCourseInfo;
    isSelected: boolean;
}

function CircularCourseNode({ info, isSelected }: { info: RoadmapCourseInfo; isSelected: boolean }) {
    const baseClasses = "w-10 h-10 text-[9px] font-bold rounded-full border-2 flex items-center justify-center transition-all";
    
    return (
        <div className={`cursor-pointer ${isSelected ? "scale-110 opacity-100" : ""}`}>
            <div className={baseClasses}>
                {info.code}
            </div>
        </div>
    );
}

const DEGREE_STAGES = [
    { id: "foundation", label: "FOUNDATION", icon: BookOpen, color: "#cbd5e1" },
    { id: "core", label: "CORE", icon: Layers, color: "#dbeafe" },
    { id: "advanced", label: "ADVANCED", icon: BookOpen, color: "#e0f2fe" },
    { id: "capstone", label: "CAPSTONE", icon: Trophy, color: "#fff0f5" },
] as const;

export interface DegreeJourneyMapProps {
    graph: CourseGraph;
    roadmap: Map<string, RoadmapCourseInfo>;
    completedCourses: Map<string, string>;
    isMobile: boolean;
    sandboxMode: boolean;
    getCourseState: (course: Course) => CourseVisualState;
    onToggleCourse: (code: string) => void;
    onOpenNotes: (course: Course) => void;
    recommendedCourses?: RoadmapCourseInfo[];
    plannedCH?: number;
    setPlan?: (plan: SemesterPlan) => void;
}

export default function DegreeJourneyMap({
    graph,
    roadmap,
    completedCourses,
    isMobile,
    sandboxMode,
    getCourseState,
    onToggleCourse,
    onOpenNotes,
    recommendedCourses = [],
    plannedCH = 0,
    setPlan,
}: Readonly<DegreeJourneyMapProps>) {
    const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
    const completedCodes = useMemo(() => new Set(completedCourses.keys()), [completedCourses]);

    // Map courses to stages for semester grouping
    const coursesByStage = useMemo(() => {
        const stages = DEGREE_STAGES.map(stage => ({
            ...stage,
            courses: [] as RoadmapCourseInfo[],
        }));
        
        for (const info of roadmap.values()) {
            const level = info.node.course.level ?? 2;
            let stageIndex = 1;
            
            if (level <= 1) stageIndex = 0;
            else if (level <= 4) stageIndex = 1;
            else if (level <= 6) stageIndex = 2;
            else stageIndex = 3;

            stages[stageIndex].courses.push(info);
        }
        
        for (const stage of stages) {
            stage.courses.sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
        }
        
        return stages;
    }, [roadmap]);

    // Get ready courses for recommendation
    const readyCourses = useMemo(() => {
        return availableNow(roadmap);
    }, [roadmap]);

    // Handle add recommended plan
    const handleAddRecommended = useCallback(() => {
        if (!setPlan) return;
        
        const totalCH = readyCourses.reduce((sum, c) => sum + (c.node.course.ch ?? 0), 0);
        if (plannedCH + totalCH <= 18) {
            setPlan({
                fall: [...readyCourses.map(c => c.code)],
                spring: [],
                summer: [],
            });
        }
    }, [readyCourses, plannedCH, setPlan]);

    // Get stats
    const completedCount = useMemo(() => countByStatus(roadmap, "Completed"), [roadmap]);
    const readyNowCount = useMemo(() => countByStatus(roadmap, "Ready Now"), [roadmap]);
    const readyAfterCount = useMemo(() => countByStatus(roadmap, "Ready After Current Term"), [roadmap]);
    const blockedCount = useMemo(() => countByStatus(roadmap, "Blocked"), [roadmap]);

    if (isMobile) {
        return (
            <div className="space-y-2">
                {/* Header with progress */}
                <div className="rounded-xl border-2 border-[#dde3ec] bg-white p-3">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[12px] font-black text-[#222d32]">DEGREE JOURNEY</h3>
                        <span className="text-[10px] font-bold text-[#92604c]">{roadmap.size} courses</span>
                    </div>
                    
                    <div className="h-2 bg-[#edf1f6] rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-[#10b981] rounded-full"
                            style={{ width: `${Math.min(100, (completedCount * 3 / 120) * 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[8px] font-bold text-[#9aa4b2] mt-1">
                        <span>{completedCount} done</span>
                        <span>{completedCount * 3} / 120 CH</span>
                    </div>
                </div>

                {/* Timeline View */}
                {coursesByStage.map((stage) => {
                    const Icon = stage.icon;
                    const readyCount = stage.courses.filter(c => c.status === "Ready Now").length;
                    
                    return (
                        <div key={stage.id} className="rounded-xl border-2 border-[#dde3ec] bg-white">
                            <div className="border-b border-[#dde3ec] px-3 py-2 bg-[#edf1f6]">
                                <h4 className="text-[10px] font-black text-[#222d32] flex items-center gap-2">
                                    <Icon className="h-3 w-3" />
                                    {stage.label}
                                    {readyCount > 0 && (
                                        <span className="text-[9px] font-bold text-[#0f7a4a] bg-[#dcfce7] px-2 py-0.5 rounded">
                                            {readyCount} ready
                                        </span>
                                    )}
                                </h4>
                            </div>
                            
                            <div className="p-2">
                                <div className="grid grid-cols-4 gap-2">
                                    {stage.courses.slice(0, 8).map(info => (
                                        <div key={info.code} className="flex flex-col items-center gap-1">
                                            <div
                                                onClick={() => setSelectedCourse(info.code)}
                                                className={`
                                                    w-10 h-10 text-[9px] font-bold rounded-full border-2
                                                    flex items-center justify-center cursor-pointer
                                                    transition-all
                                                    ${info.status === "Completed" ? "bg-[#0f7a4a]/10 border-[#0f7a4a] text-[#0f7a4a]" : ""}
                                                    ${info.status === "In Progress" ? "bg-[#fbbf24]/10 border-[#b45309] text-[#b45309]" : ""}
                                                    ${info.status === "Ready Now" ? "bg-[#dcfce7] border-[#10b981] text-[#15803d]" : ""}
                                                    ${info.status === "Ready After Current Term" ? "bg-[#fef3c7] border-[#f59e0b] text-[#b45309]" : ""}
                                                    ${info.status === "Blocked" ? "bg-[#f8fafc] border-[#64748b] text-[#64748b]" : ""}
                                                    ${info.status === "Planned" ? "bg-[#f0f4ff] border-[#7c3aed] text-[#7c3aed]" : ""}
                                                `}>
                                                {info.code}
                                            </div>
                                            <span className="text-[7px] text-[#5a6472] text-center leading-tight max-w-16 truncate">
                                                {info.node.course.name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Recommended Next Semester */}
                {readyCourses.length > 0 && (
                    <RecommendedSection
                        courses={readyCourses}
                        plannedCH={plannedCH}
                        onAddAll={handleAddRecommended}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="rounded-xl border-2 border-[#dde3ec] bg-white overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#e0f2fe] to-[#fef3c7] border-b border-[#cbd5e1] p-3">
                <h3 className="text-[11px] font-black text-[#222d32]">DEGREE JOURNEY MAP</h3>
                <p className="text-[9px] font-bold text-[#5a6472]">Click any course to view details</p>
            </div>

            {/* Stats bar */}
            <div className="flex items-center gap-4 p-2.5 bg-[#f8fafc] border-b border-[#cbd5e1] text-[9px] font-bold">
                <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-[#0f7a4a]" />
                    <span>{completedCount} completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10b981]" />
                    <span>{readyNowCount} ready now</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
                    <span>{readyAfterCount} waiting</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3 text-[#64748b]" />
                    <span>{blockedCount} blocked</span>
                </div>
            </div>

            {/* Recommended Section */}
            {readyCourses.length > 0 && (
                <RecommendedSection
                    courses={readyCourses}
                    plannedCH={plannedCH}
                    onAddAll={handleAddRecommended}
                />
            )}

            {/* Stage Legend */}
            <div className="border-t border-[#cbd5e1] p-2 bg-[#edf1f6]">
                <div className="flex gap-4 text-[8px] font-bold text-[#5a6472]">
                    {DEGREE_STAGES.map((stage) => (
                        <span key={stage.id} className="flex items-center gap-0.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS["Ready Now"] }} />
                            {stage.label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RecommendedSection({
    courses,
    plannedCH,
    onAddAll,
}: {
    courses: RoadmapCourseInfo[];
    plannedCH: number;
    onAddAll: () => void;
}) {
    const totalCH = courses.reduce((sum, c) => sum + (c.node.course.ch ?? 0), 0);
    const canAdd = plannedCH + totalCH <= 18;

    return (
        <div className="border-t border-[#cbd5e1] p-2.5">
            <h4 className="text-[10px] font-black text-[#222d32] mb-2 flex items-center gap-1.5">
                <ChevronRight className="h-3 w-3 text-[#0f7a4a]" />
                RECOMMENDED NEXT
                <span className="text-[9px] font-bold text-[#92604c]">({plannedCH} / 18 CH)</span>
            </h4>
            
            <div className="bg-[#f8fafc] rounded-lg p-2 mb-2">
                <div className="flex flex-wrap gap-1">
                    {courses.map(course => (
                        <span 
                            key={course.code} 
                            className="text-[9px] bg-white border border-[#cbd5e1] px-2 py-0.5 rounded"
                        >
                            {course.code}
                        </span>
                    ))}
                </div>
            </div>

            <button
                onClick={onAddAll}
                disabled={!canAdd}
                className={`
                    w-full py-1.5 text-[10px] font-bold rounded transition-colors
                    ${canAdd 
                        ? "bg-[#0f7a4a] text-white hover:bg-[#0f7a4a]/90" 
                        : "bg-[#cbd5e1] text-[#9aa4b2] cursor-not-allowed"
                    }
                `}
            >
                {canAdd ? "Add to Plan" : "Exceeds 18 CH limit"}
            </button>
        </div>
    );
}