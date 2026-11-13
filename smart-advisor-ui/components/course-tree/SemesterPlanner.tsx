"use client";

import { useCallback, useMemo, useState } from "react";
import {
    AlertTriangle,
    CalendarRange,
    CheckCircle2,
    Cloud,
    CloudOff,
    Loader2,
    Lock,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react";
import type { CourseGraph } from "@/lib/course-tree/types";
import type { RoadmapCourseInfo } from "@/lib/course-tree/roadmap";
import {
    PLAN_SEMESTERS,
    addCourseToPlan,
    allPlannedCodes,
    buildPlanWarnings,
    planCredits,
    planSemesterYear,
    RECOMMENDED_MAX_CH,
    removeCourseFromPlan,
    semesterLabel,
    semesterMaxCH,
    type PlanSemesterKey,
    type SemesterPlan,
} from "@/lib/course-tree/semester-plan";
import { RoadmapStatusPill, ROADMAP_STATUS_THEME } from "./visuals";

export interface SemesterPlannerProps {
    graph: CourseGraph;
    roadmap: Map<string, RoadmapCourseInfo>;
    plan: SemesterPlan;
    onPlanChange: (plan: SemesterPlan) => void;
    onOpenDetail: (code: string) => void;
}

type SyncState = "idle" | "saving" | "success" | "error";

interface CloudSemester {
    id: number;
    name?: string;
    type?: string | null;
    year?: number | null;
    courses?: Array<{ code?: string }>;
}

export default function SemesterPlanner({
    graph,
    roadmap,
    plan,
    onPlanChange,
    onOpenDetail,
}: Readonly<SemesterPlannerProps>) {
    const [targetSemester, setTargetSemester] = useState<PlanSemesterKey>("fall");
    const [query, setQuery] = useState("");
    const [showLocked, setShowLocked] = useState(false);
    const [pendingLocked, setPendingLocked] = useState<{ code: string; semester: PlanSemesterKey } | null>(null);
    const [syncState, setSyncState] = useState<SyncState>("idle");
    const [syncMessage, setSyncMessage] = useState("");

    const credits = useMemo(() => planCredits(plan, graph), [plan, graph]);
    const totalCH = credits.fall + credits.spring + credits.summer;
    const plannedCodes = useMemo(() => allPlannedCodes(plan), [plan]);
    const warnings = useMemo(() => buildPlanWarnings(plan, graph, roadmap), [plan, graph, roadmap]);

    const pickerCourses = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const all = graph.order
            .map((code) => roadmap.get(code))
            .filter((info): info is RoadmapCourseInfo => !!info)
            .filter((info) => info.status !== "Completed")
            .filter((info) => !plannedCodes.has(info.code))
            .filter((info) => showLocked || info.status !== "Blocked")
            .filter(
                (info) =>
                    !needle ||
                    info.code.toLowerCase().includes(needle) ||
                    info.node.course.name.toLowerCase().includes(needle)
            );

        return all.sort(
            (a, b) =>
                (a.status === "Ready Now" ? 0 : 1) - (b.status === "Ready Now" ? 0 : 1) ||
                (a.node.course.level ?? 1) - (b.node.course.level ?? 1) ||
                a.code.localeCompare(b.code)
        );
    }, [graph, roadmap, plannedCodes, query, showLocked]);

    const commitAdd = useCallback(
        (code: string, semester: PlanSemesterKey) => {
            onPlanChange(addCourseToPlan(plan, semester, code));
            setPendingLocked(null);
            setQuery("");
        },
        [onPlanChange, plan]
    );

    const requestAdd = useCallback(
        (code: string, semester: PlanSemesterKey) => {
            const info = roadmap.get(code);
            if (info?.status === "Blocked") {
                setPendingLocked({ code, semester });
                return;
            }
            commitAdd(code, semester);
        },
        [roadmap, commitAdd]
    );

    const remove = useCallback(
        (code: string, semester: PlanSemesterKey) => {
            onPlanChange(removeCourseFromPlan(plan, code, semester));
        },
        [onPlanChange, plan]
    );

    const handlePlanSemester = useCallback(async () => {
        if (totalCH === 0) {
            setSyncState("error");
            setSyncMessage("Add at least one course before planning a semester.");
            return;
        }

        setSyncState("saving");
        setSyncMessage("Saving your plan…");

        try {
            const semestersResponse = await fetch("/api/planner/semesters");

            if (semestersResponse.status === 401) {
                setSyncState("success");
                setSyncMessage(
                    "Plan saved on this device. Sign in to sync it with your cloud semester planner."
                );
                return;
            }

            if (!semestersResponse.ok) {
                throw new Error("Could not load your planner semesters.");
            }

            const semestersPayload = (await semestersResponse.json()) as {
                semesters?: CloudSemester[];
            };
            const cloudSemesters = semestersPayload.semesters ?? [];

            let added = 0;
            let skipped = 0;

            for (const { key, type } of PLAN_SEMESTERS) {
                const codes = plan[key];
                if (codes.length === 0) continue;

                const year = planSemesterYear(key);
                let cloudSemester = cloudSemesters.find(
                    (semester) =>
                        semester.type === type && Number(semester.year) === year
                );

                if (!cloudSemester) {
                    const createResponse = await fetch("/api/planner/semesters", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            type,
                            year,
                            name: `${type} ${year}`,
                            start_date: null,
                            end_date: null,
                        }),
                    });
                    if (!createResponse.ok) {
                        throw new Error(`Could not create the ${type} semester.`);
                    }
                    const created = (await createResponse.json()) as {
                        semester?: CloudSemester;
                    };
                    if (!created.semester) throw new Error(`Could not create the ${type} semester.`);
                    cloudSemester = { ...created.semester, courses: created.semester.courses ?? [] };
                    cloudSemesters.push(cloudSemester);
                }

                const existingCodes = new Set(
                    (cloudSemester.courses ?? []).map((course) =>
                        (course.code ?? "").toUpperCase()
                    )
                );

                for (const code of codes) {
                    if (existingCodes.has(code.toUpperCase())) {
                        skipped += 1;
                        continue;
                    }

                    const node = graph.nodes.get(code);
                    if (!node) continue;

                    const courseResponse = await fetch("/api/planner/courses", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            semester_id: cloudSemester.id,
                            code,
                            name: node.course.name,
                            credits: node.course.ch,
                        }),
                    });

                    if (courseResponse.status === 401) {
                        setSyncState("success");
                        setSyncMessage(
                            "Plan saved on this device. Sign in to sync it with your cloud semester planner."
                        );
                        return;
                    }

                    if (courseResponse.status === 400) {
                        skipped += 1;
                        continue;
                    }

                    if (!courseResponse.ok) {
                        throw new Error(`Could not add ${code} to the cloud planner.`);
                    }

                    added += 1;
                    existingCodes.add(code.toUpperCase());
                }
            }

            setSyncState("success");
            setSyncMessage(
                added > 0
                    ? `Plan saved locally and synced: ${added} course${added === 1 ? "" : "s"} added${skipped > 0 ? `, ${skipped} already in your planner` : ""}.`
                    : skipped > 0
                        ? "Plan saved locally. Every planned course is already in your cloud planner."
                        : "Plan saved locally."
            );
        } catch (error) {
            setSyncState("error");
            setSyncMessage(
                `${error instanceof Error ? error.message : "Cloud sync failed."} Your plan is still saved on this device.`
            );
        }
    }, [graph, plan, totalCH]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div>
                    <h3 className="flex items-center gap-2 text-sm font-black text-[#222d32]">
                        <CalendarRange className="h-4 w-4 text-[#dc4835]" />
                        Semester planner
                    </h3>
                    <p className="text-[10px] font-bold text-[#5a6472]">
                        Build Fall, Spring, and Summer plans. {RECOMMENDED_MAX_CH} CH is the
                        recommended maximum for a regular semester.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void handlePlanSemester()}
                    disabled={syncState === "saving"}
                    className="ml-auto flex items-center gap-2 rounded-lg bg-[#dc4835] px-3 py-2 text-[11px] font-black text-white transition-colors hover:bg-[#b83827] disabled:cursor-wait disabled:opacity-70"
                >
                    {syncState === "saving" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    Plan semester
                </button>
            </div>

            {totalCH > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#dde3ec] bg-[#f8fafc] px-3 py-2 text-[10px] font-bold text-[#5a6472]">
                    <span>
                        <span className="font-black text-[#222d32]">{totalCH} CH</span> planned across{" "}
                        {PLAN_SEMESTERS.filter((semester) => plan[semester.key].length > 0).length} semester
                        {PLAN_SEMESTERS.filter((semester) => plan[semester.key].length > 0).length === 1 ? "" : "s"}
                    </span>
                    <span className="hidden h-3 w-px bg-[#dde3ec] sm:block" />
                    <span>
                        Remaining to {RECOMMENDED_MAX_CH} CH in your target semester:{" "}
                        <span className="font-black text-[#222d32]">
                            {Math.max(0, semesterMaxCH(targetSemester) - credits[targetSemester])} CH
                        </span>
                    </span>
                </div>
            )}

            {warnings.length > 0 && (
                <div className="rounded-xl border-2 border-[#f39c14]/30 bg-[#f39c14]/[0.05] p-3" role="status">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#b45309]">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Plan warnings
                    </p>
                    <ul className="mt-1.5 space-y-1">
                        {warnings.slice(0, 5).map((warning) => (
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
                    {warnings.length > 5 && (
                        <p className="mt-1 text-[9px] font-bold text-[#92604c]">
                            {warnings.length - 5} more warning{warnings.length - 5 > 1 ? "s" : ""}.
                        </p>
                    )}
                </div>
            )}

            <div className="grid gap-3 lg:grid-cols-3">
                {PLAN_SEMESTERS.map(({ key, label, maxCH }) => {
                    const courseCodes = plan[key];
                    const semesterCredits = credits[key];
                    const over = semesterCredits > maxCH;
                    return (
                        <section
                            key={key}
                            data-testid="planner-semester"
                            data-semester={key}
                            className={`flex flex-col rounded-xl border-2 bg-white p-3 ${
                                over ? "border-[#dc4835]/45" : "border-[#dde3ec]"
                            }`}
                        >
                            <header className="flex items-center justify-between gap-2 border-b border-[#dde3ec]/70 pb-2">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-[0.14em] text-[#222d32]">
                                        {label}
                                    </h4>
                                    <p className="text-[9px] font-bold text-[#9aa4b2]">
                                        {semesterCredits} / {maxCH} CH
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] ${
                                        over
                                            ? "border-[#dc4835]/35 bg-[#dc4835]/8 text-[#a52f21]"
                                            : "border-[#dde3ec] bg-[#f8fafc] text-[#5a6472]"
                                    }`}
                                >
                                    {courseCodes.length} course{courseCodes.length === 1 ? "" : "s"}
                                </span>
                            </header>

                            <div className="mt-2 flex-1 space-y-1.5">
                                {courseCodes.length === 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => setTargetSemester(key)}
                                        className="flex h-20 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#dde3ec] text-[10px] font-bold text-[#9aa4b2] transition-colors hover:border-[#dc4835]/40 hover:text-[#dc4835]"
                                    >
                                        <Plus className="mb-1 h-4 w-4" />
                                        Add courses below
                                    </button>
                                ) : (
                                    courseCodes.map((code) => {
                                        const info = roadmap.get(code);
                                        const node = graph.nodes.get(code);
                                        if (!info || !node) return null;
                                        return (
                                            <div
                                                key={code}
                                                className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 ${ROADMAP_STATUS_THEME[info.status].card}`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenDetail(code)}
                                                    className="min-w-0 flex-1 text-left"
                                                    title={`Open details for ${node.course.name}`}
                                                >
                                                    <p className="font-mono text-[9px] font-black tracking-[0.12em] text-[#92604c]">
                                                        {code}
                                                    </p>
                                                    <p className="truncate text-[11px] font-black text-[#222d32]">
                                                        {node.course.name}
                                                    </p>
                                                    <p className="mt-0.5 flex items-center gap-1.5 text-[8.5px] font-bold text-[#5a6472]">
                                                        <span>{node.course.ch} CH</span>
                                                        <RoadmapStatusPill status={info.status} />
                                                    </p>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => remove(code, key)}
                                                    aria-label={`Remove ${node.course.name} from ${label}`}
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#9aa4b2] transition-colors hover:bg-[#dc4835]/10 hover:text-[#dc4835]"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </section>
                    );
                })}
            </div>

            {/* Course picker */}
            <div className="rounded-xl border-2 border-[#dde3ec] bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5a6472]">
                        Add to
                    </p>
                    <div className="flex rounded-lg border border-[#dde3ec] bg-[#edf1f6] p-0.5">
                        {PLAN_SEMESTERS.map(({ key, label }) => (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTargetSemester(key)}
                                aria-pressed={targetSemester === key}
                                className={`rounded-md px-2.5 py-1 text-[10px] font-black transition-colors ${
                                    targetSemester === key
                                        ? "bg-white text-[#dc4835] shadow-sm"
                                        : "text-[#5a6472] hover:text-[#222d32]"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="relative min-w-[180px] flex-1">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5a6472]" />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search courses to add…"
                            aria-label="Search courses to add to the plan"
                            className="w-full rounded-lg border border-[#dde3ec] bg-white py-2 pl-8 pr-2.5 text-[11px] font-bold text-[#222d32] placeholder:text-[#9aa4b2] focus:border-[#dc4835] focus:outline-none"
                        />
                    </div>

                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#dde3ec] px-2 py-1.5 text-[9px] font-bold text-[#5a6472]">
                        <input
                            type="checkbox"
                            checked={showLocked}
                            onChange={(event) => setShowLocked(event.target.checked)}
                            className="h-3 w-3 accent-[#dc4835]"
                        />
                        Show locked
                    </label>
                </div>

                {pendingLocked && (
                    <div
                        role="alert"
                        className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#dc4835]/30 bg-[#dc4835]/[0.05] px-2.5 py-2 text-[10px] font-bold text-[#a52f21]"
                    >
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 flex-1">
                            {pendingLocked.code} is locked
                            {roadmap.get(pendingLocked.code)?.missingPrereqs.length
                                ? ` — complete ${roadmap.get(pendingLocked.code)?.missingPrereqs.join(", ")} first`
                                : ""}
                            . Add it anyway?
                        </span>
                        <button
                            type="button"
                            onClick={() => commitAdd(pendingLocked.code, pendingLocked.semester)}
                            className="rounded-md bg-[#dc4835] px-2 py-1 text-[9px] font-black text-white hover:bg-[#b83827]"
                        >
                            Add anyway
                        </button>
                        <button
                            type="button"
                            onClick={() => setPendingLocked(null)}
                            className="flex items-center gap-0.5 rounded-md border border-[#dc4835]/30 px-2 py-1 text-[9px] font-black hover:bg-white"
                        >
                            <X className="h-3 w-3" />
                            Cancel
                        </button>
                    </div>
                )}

                {pickerCourses.length === 0 ? (
                    <p className="mt-3 rounded-lg border border-dashed border-[#dde3ec] px-3 py-6 text-center text-[10px] font-bold text-[#9aa4b2]">
                        {query
                            ? "No matching course. Try another code or name."
                            : plannedCodes.size > 0
                                ? "Every remaining course is already in your plan."
                                : "No courses to add yet."}
                    </p>
                ) : (
                    <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
                        {pickerCourses.map((info) => (
                            <li
                                key={info.code}
                                className="flex items-center gap-2 rounded-lg border border-[#dde3ec] px-2 py-1.5"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="flex flex-wrap items-center gap-1.5">
                                        <span className="font-mono text-[9px] font-black tracking-[0.12em] text-[#92604c]">
                                            {info.code}
                                        </span>
                                        <span className="truncate text-[11px] font-black text-[#222d32]">
                                            {info.node.course.name}
                                        </span>
                                        {info.status === "Blocked" && (
                                            <Lock className="h-2.5 w-2.5 shrink-0 text-[#9aa4b2]" />
                                        )}
                                    </p>
                                    <p className="flex flex-wrap items-center gap-1.5 text-[8.5px] font-bold text-[#5a6472]">
                                        <span>{info.node.course.ch} CH</span>
                                        <RoadmapStatusPill status={info.status} />
                                        {info.status === "Blocked" && info.missingPrereqs.length > 0 && (
                                            <span className="truncate text-[#dc4835]/80">
                                                Missing {info.missingPrereqs.join(", ")}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => requestAdd(info.code, targetSemester)}
                                    className="shrink-0 rounded-md border border-[#dde3ec] px-2 py-1 text-[9px] font-black text-[#5a6472] transition-colors hover:border-[#dc4835] hover:text-[#dc4835]"
                                >
                                    Add to {semesterLabel(targetSemester)}
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div
                aria-live="polite"
                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-[10px] font-bold ${
                    syncState === "error"
                        ? "border-[#dc4835]/25 bg-[#dc4835]/[0.04] text-[#a52f21]"
                        : syncState === "success"
                            ? "border-[#0da55a]/25 bg-[#0da55a]/[0.04] text-[#0f7a4a]"
                            : "border-[#dde3ec] bg-[#f8fafc] text-[#5a6472]"
                }`}
            >
                {syncState === "saving" ? (
                    <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : syncState === "error" ? (
                    <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                    <Cloud className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                    {syncMessage ||
                        "Your plan is saved on this device automatically. “Plan semester” also adds it to your cloud Semester Planner."}
                </span>
            </div>
        </div>
    );
}
