"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    ArrowUpRight,
    CheckCircle2,
    ExternalLink,
    Lock,
    Network,
    NotebookPen,
    PlayCircle,
    Plus,
    X,
} from "lucide-react";
import type { CourseGraph } from "@/lib/course-tree/types";
import type { RoadmapCourseInfo } from "@/lib/course-tree/roadmap";
import { semesterLabel, type PlanSemesterKey } from "@/lib/course-tree/semester-plan";
import { safeStorage } from "@/lib/safe-storage";
import { FrameworkBadge, RoadmapStatusPill } from "./visuals";

export interface CourseDrawerProps {
    info: RoadmapCourseInfo | null;
    graph: CourseGraph;
    roadmap: Map<string, RoadmapCourseInfo>;
    plannedSemester: PlanSemesterKey | null;
    onClose: () => void;
    onSelectCourse: (code: string) => void;
    onToggleCompleted: (code: string) => void;
    onToggleInProgress: (code: string) => void;
    onPlanToggle: (code: string) => void;
    onExplore: (code: string) => void;
}

function noteKey(code: string): string {
    return `mubxai-roadmap-note:${code}`;
}

interface RelationChipProps {
    code: string;
    graph: CourseGraph;
    roadmap: Map<string, RoadmapCourseInfo>;
    tone: "prereq" | "unlock";
    onSelectCourse: (code: string) => void;
}

function RelationChip({ code, graph, roadmap, tone, onSelectCourse }: Readonly<RelationChipProps>) {
    const node = graph.nodes.get(code);
    const status = roadmap.get(code)?.status;
    const isMissing =
        tone === "prereq" &&
        status !== "Completed" &&
        status !== "In Progress";
    const palette =
        tone === "unlock"
            ? "border-[#0da55a]/25 bg-[#0da55a]/[0.06] hover:border-[#0da55a]/60"
            : isMissing
                ? "border-[#dc4835]/25 bg-[#dc4835]/[0.05] hover:border-[#dc4835]/50"
                : "border-[#2563eb]/25 bg-[#2563eb]/[0.05] hover:border-[#2563eb]/50";

    if (!node) {
        return (
            <span
                className="inline-flex flex-col rounded-lg border border-dashed border-[#dde3ec] bg-[#f8fafc] px-2 py-1 text-left"
                title="External requirement (not in this major's catalog)"
            >
                <span className="font-mono text-[10px] font-black text-[#92604c]">{code}</span>
                <span className="text-[9px] font-bold text-[#9aa4b2]">External requirement</span>
            </span>
        );
    }

    return (
        <button
            type="button"
            onClick={() => onSelectCourse(code)}
            className={`inline-flex max-w-full flex-col rounded-lg border px-2 py-1 text-left transition-colors cursor-pointer ${palette}`}
            title={`${node.course.name} — open details`}
        >
            <span className="flex items-center gap-1 font-mono text-[10px] font-black text-[#92604c]">
                {isMissing && <Lock className="h-2.5 w-2.5 text-[#dc4835]/70" />}
                {code}
            </span>
            <span className="max-w-[11rem] truncate text-[10px] font-bold text-[#222d32]">
                {node.course.name}
            </span>
        </button>
    );
}

function Section({
    title,
    children,
    tone = "neutral",
}: Readonly<{ title: string; children: React.ReactNode; tone?: "neutral" | "blue" | "green" | "amber" }>) {
    const color =
        tone === "blue"
            ? "text-[#2563eb]"
            : tone === "green"
                ? "text-[#0f7a4a]"
                : tone === "amber"
                    ? "text-[#b45309]"
                    : "text-[#5a6472]";
    return (
        <section className="space-y-1.5">
            <h4 className={`text-[9px] font-black uppercase tracking-[0.2em] ${color}`}>{title}</h4>
            {children}
        </section>
    );
}

export default function CourseDrawer({
    info,
    graph,
    roadmap,
    plannedSemester,
    onClose,
    onSelectCourse,
    onToggleCompleted,
    onToggleInProgress,
    onPlanToggle,
    onExplore,
}: Readonly<CourseDrawerProps>) {
    const [note, setNote] = useState("");
    const [noteCode, setNoteCode] = useState<string | null>(null);

    const code = info?.code ?? null;

    useEffect(() => {
        if (!code) return;
        setNote(safeStorage.get(noteKey(code)) ?? "");
        setNoteCode(code);
    }, [code]);

    useEffect(() => {
        if (!code || noteCode !== code) return;
        safeStorage.set(noteKey(code), note);
    }, [note, code, noteCode]);

    const handleNoteChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNote(event.target.value);
    }, []);

    useEffect(() => {
        if (!info) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [info, onClose]);

    const corequisites = info?.node.gates.filter((gate) => gate.gate === "concurrent") ?? [];
    const otherGates = info?.node.gates.filter((gate) => gate.gate !== "concurrent") ?? [];
    const isCompleted = info?.status === "Completed";
    const isInProgress = info?.status === "In Progress";
    const isPlanned = plannedSemester !== null;

    return (
        <AnimatePresence>
            {info && (
                <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
                    <motion.button
                        type="button"
                        aria-label="Close course details"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        onClick={onClose}
                        className="absolute inset-0 cursor-default bg-[#222d32]/35 backdrop-blur-[2px]"
                    />

                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="course-drawer-title"
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                        className="relative flex h-full w-full max-w-md flex-col border-l-2 border-[#dde3ec] bg-white shadow-2xl sm:max-w-lg"
                    >
                        <header className="shrink-0 border-b border-[#dde3ec] bg-white px-4 py-4 sm:px-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-black tracking-[0.16em] text-[#92604c]">
                                        {info.code}
                                        <span className="font-sans text-[9px] uppercase tracking-[0.14em] text-[#9aa4b2]">
                                            {info.category}
                                        </span>
                                    </p>
                                    <h2
                                        id="course-drawer-title"
                                        className="mt-1 text-lg font-black leading-tight text-[#222d32]"
                                    >
                                        {info.node.course.name}
                                    </h2>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        <RoadmapStatusPill status={info.status} />
                                        <FrameworkBadge framework={info.node.course.framework} />
                                        {isPlanned && plannedSemester && (
                                            <span className="rounded-full border border-[#f39c14]/40 bg-[#f39c14]/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-[#b45309]">
                                                Planned · {semesterLabel(plannedSemester)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close course details"
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#dde3ec] text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835]"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </header>

                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-[#dde3ec] bg-[#f8fafc] px-3 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">Credit hours</p>
                                    <p className="text-sm font-black text-[#222d32]">{info.node.course.ch} CH</p>
                                </div>
                                <div className="rounded-lg border border-[#dde3ec] bg-[#f8fafc] px-3 py-2">
                                    <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#9aa4b2]">Recommended</p>
                                    <p className="text-sm font-black text-[#222d32]">
                                        Year {info.node.course.level ?? 1}
                                    </p>
                                </div>
                            </div>

                            <Section title="Description">
                                <p className="text-xs leading-relaxed text-[#5a6472]">
                                    {info.node.course.description?.trim()
                                        ? info.node.course.description
                                        : `No catalog description is available for this course yet. It is a ${info.category.toLowerCase()} course recommended for Year ${info.node.course.level ?? 1}.`}
                                </p>
                            </Section>

                            <Section title="Prerequisites" tone="blue">
                                {info.prereqCodes.length === 0 ? (
                                    <p className="text-xs font-bold text-[#5a6472]">No prerequisite courses.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {info.prereqCodes.map((prereq) => (
                                            <RelationChip
                                                key={prereq}
                                                code={prereq}
                                                graph={graph}
                                                roadmap={roadmap}
                                                tone="prereq"
                                                onSelectCourse={onSelectCourse}
                                            />
                                        ))}
                                    </div>
                                )}
                                {info.node.course.prereq && (
                                    <p className="mt-1 text-[10px] font-bold text-[#92604c]">
                                        Catalog rule: <span className="font-mono">{info.node.course.prereq}</span>
                                    </p>
                                )}
                                {info.status === "Blocked" && (
                                    <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#dc4835]/20 bg-[#dc4835]/[0.05] p-2 text-[10px] font-bold text-[#a52f21]">
                                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                        <span>
                                            Complete or start {info.missingPrereqs.join(", ") || "the missing requirements"} to unlock this course.
                                        </span>
                                    </div>
                                )}
                            </Section>

                            <Section title="Corequisites" tone="amber">
                                {corequisites.length > 0 ? (
                                    <ul className="space-y-1">
                                        {corequisites.map((gate) => (
                                            <li key={gate.label} className="text-xs font-bold text-[#5a6472]">
                                                {gate.label}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs font-bold text-[#5a6472]">No corequisites listed.</p>
                                )}
                            </Section>

                            {otherGates.length > 0 && (
                                <Section title="Other requirements" tone="amber">
                                    <ul className="space-y-1">
                                        {otherGates.map((gate) => (
                                            <li key={gate.label} className="text-xs font-bold text-[#5a6472]">
                                                {gate.label}
                                            </li>
                                        ))}
                                    </ul>
                                </Section>
                            )}

                            <Section title="Unlocks" tone="green">
                                {info.unlockCodes.length === 0 ? (
                                    <p className="text-xs font-bold text-[#5a6472]">
                                        This is a terminal course — it does not unlock another course directly.
                                    </p>
                                ) : (
                                    <div className="flex flex-wrap gap-1.5">
                                        {info.unlockCodes.map((unlock) => (
                                            <RelationChip
                                                key={unlock}
                                                code={unlock}
                                                graph={graph}
                                                roadmap={roadmap}
                                                tone="unlock"
                                                onSelectCourse={onSelectCourse}
                                            />
                                        ))}
                                    </div>
                                )}
                            </Section>

                            <Section title="Your status" tone="neutral">
                                <div className="flex flex-wrap gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() => onToggleCompleted(info.code)}
                                        aria-pressed={isCompleted}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${
                                            isCompleted
                                                ? "border-[#0da55a]/45 bg-[#0da55a]/12 text-[#0f7a4a]"
                                                : "border-[#dde3ec] text-[#5a6472] hover:border-[#0da55a]/50 hover:text-[#0f7a4a]"
                                        }`}
                                    >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                        {isCompleted ? "Completed" : "Mark completed"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onToggleInProgress(info.code)}
                                        aria-pressed={isInProgress}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${
                                            isInProgress
                                                ? "border-[#f39c14]/45 bg-[#f39c14]/12 text-[#b45309]"
                                                : "border-[#dde3ec] text-[#5a6472] hover:border-[#f39c14]/50 hover:text-[#b45309]"
                                        }`}
                                    >
                                        <PlayCircle className="h-3.5 w-3.5" />
                                        {isInProgress ? "In progress" : "Mark in progress"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onPlanToggle(info.code)}
                                        aria-pressed={isPlanned}
                                        className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-colors ${
                                            isPlanned
                                                ? "border-[#dc4835]/35 bg-[#dc4835]/8 text-[#dc4835]"
                                                : "border-[#dde3ec] text-[#5a6472] hover:border-[#dc4835]/50 hover:text-[#dc4835]"
                                        }`}
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        {isPlanned ? `Planned · ${plannedSemester ? semesterLabel(plannedSemester) : ""}` : "Add to plan"}
                                    </button>
                                </div>
                            </Section>

                            <Section title="Personal notes">
                                <label htmlFor="course-drawer-notes" className="sr-only">
                                    Personal notes for {info.node.course.name}
                                </label>
                                <div className="relative">
                                    <NotebookPen className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#9aa4b2]" />
                                    <textarea
                                        id="course-drawer-notes"
                                        value={note}
                                        onChange={handleNoteChange}
                                        rows={4}
                                        placeholder="Add a note for yourself (saved on this device)…"
                                        className="w-full resize-y rounded-lg border border-[#dde3ec] bg-white py-2 pl-8 pr-2.5 text-xs font-bold text-[#222d32] placeholder:text-[#9aa4b2] focus:border-[#dc4835] focus:outline-none"
                                    />
                                </div>
                                <p className="text-[9px] font-bold text-[#9aa4b2]">
                                    Notes stay on this device and are kept per course.
                                </p>
                            </Section>
                        </div>

                        <footer className="shrink-0 border-t border-[#dde3ec] bg-[#f8fafc] px-4 py-3 sm:px-5">
                            <button
                                type="button"
                                onClick={() => onExplore(info.code)}
                                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#dc4835] px-3 py-2.5 text-xs font-black text-white transition-colors hover:bg-[#b83827]"
                            >
                                <Network className="h-4 w-4" />
                                View in prerequisite explorer
                                <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                            <p className="mt-2 flex items-center justify-center gap-1 text-[9px] font-bold text-[#9aa4b2]">
                                <ExternalLink className="h-2.5 w-2.5" />
                                Prerequisite data comes from the official curriculum
                            </p>
                        </footer>
                    </motion.aside>
                </div>
            )}
        </AnimatePresence>
    );
}
