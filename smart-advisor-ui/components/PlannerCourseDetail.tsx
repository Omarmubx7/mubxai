"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/session-stub";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clock, Save, History, PlayCircle, CheckCircle2, BookOpen, Calendar as CalendarIcon, Info } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useToast } from "./ui/Toast";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchWithRetry, fetchJSON } from "@/lib/fetch-retry";

const CourseNotesEditor = dynamic(() => import("./CourseNotesEditor"), {
    ssr: false,
    loading: () => (
        <div className="h-100 w-full bg-white animate-pulse rounded-[2.5rem] border border-[#dde3ec] flex items-center justify-center">
            <span className="text-xs font-black uppercase tracking-widest text-[#5a6472]">Loading Editor...</span>
        </div>
    ),
});

type NotesContent = Record<string, unknown> | string | null;

interface StudySession {
    id: number;
    type: string;
    duration_minutes: number;
}

interface SemesterMeta {
    start_date?: string | null;
    end_date?: string | null;
}

interface PlannerCourse {
    id: number;
    semester_id: number;
    code: string;
    name: string;
    credits: number;
    midterm_date?: string | null;
    final_date?: string | null;
    instructor_name?: string | null;
    location?: string | null;
    final_mark?: number | null;
    status?: string | null;
    class_schedule?: string | null;
    course_notes?: Array<{ content: NotesContent }>;
    semester?: SemesterMeta;
}

interface SemesterWithCourses extends SemesterMeta {
    courses: PlannerCourse[];
}

interface SemesterResponse {
    semesters: SemesterWithCourses[];
}

const ALL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toDateTimeLocalValue(dateValue?: string | null): string {
    if (!dateValue) return "";
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
}

function isJsonLikeScheduleText(value: string): boolean {
    const trimmed = value.trim();
    return (trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith('"') && trimmed.endsWith('"'));
}

function extractScheduleText(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value) && value.length > 0) return String(value[0] || "");
    return "";
}

function safeJsonParse(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function parseScheduleText(scheduleData: unknown): string {
    const rawText = extractScheduleText(scheduleData);
    if (!rawText) return "";
    if (!isJsonLikeScheduleText(rawText)) return rawText;

    const parsed = safeJsonParse(rawText);
    const parsedText = extractScheduleText(parsed);
    return parsedText || rawText;
}

function parseScheduleParts(scheduleData: unknown): { days: string[]; startTime: string; endTime: string } {
    const scheduleText = parseScheduleText(scheduleData);
    const [daysPart = "", timePart = ""] = scheduleText.split(" ");
    const days = daysPart.split("/").filter((day) => ALL_DAYS.includes(day));
    const [startTime = "", endTime = ""] = timePart.split("-");
    return { days, startTime, endTime };
}

function findPlannerCourse(semesters: SemesterWithCourses[], courseId: string): PlannerCourse | null {
    for (const sem of semesters) {
        const match = sem.courses.find((course: PlannerCourse) => course.id.toString() === courseId);
        if (match) return { ...match, semester: sem };
    }
    return null;
}

function validateDateWithinSemester(dateValue: string, label: string, semester?: SemesterMeta): string | null {
    if (!dateValue) return null;

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return `Invalid ${label.toLowerCase()} date format.`;

    if (semester?.start_date) {
        const semStart = new Date(semester.start_date);
        if (date < semStart) return `${label} date cannot be before semester start date.`;
    }

    if (semester?.end_date) {
        const semEnd = new Date(semester.end_date);
        if (date > semEnd) return `${label} date cannot be after semester end date.`;
    }

    return null;
}

function validateDateOrder(midtermValue: string, finalValue: string): string | null {
    if (!midtermValue || !finalValue) return null;

    const midterm = new Date(midtermValue);
    const final = new Date(finalValue);
    if (final <= midterm) return "Final exam must be scheduled after the Midterm.";

    return null;
}

export default function PlannerCourseDetail({ courseId }: { readonly courseId: string }) {
    const { status } = useSession();
    const router = useRouter();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [course, setCourse] = useState<PlannerCourse | null>(null);
    const [sessions, setSessions] = useState<StudySession[]>([]);

    // New Session State
    const [duration, setDuration] = useState<number>(30);
    const [sessionType, setSessionType] = useState("reading");
    const [sessionNotes, setSessionNotes] = useState("");
    const [logging, setLogging] = useState(false);

    // Notes State
    const [courseContent, setCourseContent] = useState<NotesContent>(null);

    // Exam Dates State
    const [midtermDate, setMidtermDate] = useState<string>("");
    const [finalDate, setFinalDate] = useState<string>("");
    const [savingDates, setSavingDates] = useState(false);

    // Course Metadata State
    const [instructorName, setInstructorName] = useState("");
    const [location, setLocation] = useState("");
    const [courseStatus, setCourseStatus] = useState("planned");
    const [finalMark, setFinalMark] = useState<number | "">("");
    const [savingInfo, setSavingInfo] = useState(false);

    // Class Schedule State (Replaces flat string)
    const [scheduleDays, setScheduleDays] = useState<string[]>([]);
    const [scheduleTime, setScheduleTime] = useState("");
    const [scheduleEndTime, setScheduleEndTime] = useState("");

    const parseAndSetSchedule = (scheduleData: unknown) => {
        const { days, startTime, endTime } = parseScheduleParts(scheduleData);
        setScheduleDays(days);
        setScheduleTime(startTime);
        setScheduleEndTime(endTime);
    };

    const fetchSessions = async () => {
        try {
            const sessData = await fetchJSON<{ sessions: StudySession[] }>(`/api/planner/study-sessions?courseId=${courseId}`, { retries: 2 });
            setSessions(sessData.sessions || []);
        } catch (error) {
            console.error("Failed to load sessions", error);
            toast("Could not load study sessions", "error");
        }
    };

    const fetchCourseData = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetchWithRetry("/api/planner/semesters", { retries: 2 });
            if (!res.ok) {
                toast("Failed to load course data", "error");
                return;
            }

            const data = await res.json() as SemesterResponse;
            const foundCourse = findPlannerCourse(data.semesters, courseId);
            if (!foundCourse) {
                alert("Course not found.");
                router.push("/planner/semesters");
                return;
            }

            setCourse(foundCourse);

            setMidtermDate(toDateTimeLocalValue(foundCourse.midterm_date));
            setFinalDate(toDateTimeLocalValue(foundCourse.final_date));
            setInstructorName(foundCourse.instructor_name ?? "");
            setLocation(foundCourse.location ?? "");
            setFinalMark(foundCourse.final_mark ?? "");
            setCourseStatus(foundCourse.status ?? "planned");
            parseAndSetSchedule(foundCourse.class_schedule);

            // Fetch dedicated course notes content if available
            try {
                const notesData = await fetchJSON<{ notes: NotesContent }>(`/api/courses/${courseId}/notes`, { retries: 2 });
                setCourseContent(notesData.notes);
            } catch (error) { 
                console.error("Failed to load notes", error); 
            }

            await fetchSessions();
        } catch (error) {
            console.error(error);
            toast(`Failed to load course: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setLoading(false);
        }
    }, [courseId, router]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchCourseData();
        }
    }, [status, router, courseId, fetchCourseData]);

    const handleAutoSaveNotes = async (content: NotesContent) => {
        try {
            await fetchWithRetry(`/api/courses/${courseId}/notes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes: content }),
                retries: 2
            });
        } catch (error) {
            console.error("Failed to autosave notes:", error);
        }
    };

    const handleLogSession = async () => {
        setLogging(true);
        try {
            const res = await fetchWithRetry("/api/planner/study-sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    course_id: courseId,
                    duration_minutes: duration,
                    type: sessionType,
                    notes: sessionNotes || null
                }),
                retries: 2
            });

            if (res.ok) {
                const data = await res.json();
                toast(`Session Logged! Earned ${data.earnedXP} XP.`, "success");
                setSessions([data.session, ...sessions]);
                setDuration(30);
                setSessionNotes("");
            } else {
                throw new Error("Failed to log session");
            }
        } catch (error) {
            console.error(error);
            toast(`Failed to log session: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setLogging(false);
        }
    };



    const handleSaveDates = async () => {
        if (!course) return;
        const midtermError = validateDateWithinSemester(midtermDate, "Midterm", course.semester);
        if (midtermError) {
            toast(midtermError, "error");
            return;
        }

        const finalError = validateDateWithinSemester(finalDate, "Final exam", course.semester);
        if (finalError) {
            toast(finalError, "error");
            return;
        }

        const orderError = validateDateOrder(midtermDate, finalDate);
        if (orderError) {
            toast(orderError, "error");
            return;
        }

        setSavingDates(true);
        try {
            const res = await fetchWithRetry(`/api/planner/courses/${course.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    midterm_date: midtermDate ? new Date(midtermDate).toISOString() : null,
                    final_date: finalDate ? new Date(finalDate).toISOString() : null
                }),
                retries: 2
            });

            if (res.ok) {
                toast("Exam dates saved successfully!", "success");
            } else {
                const data = await res.json();
                toast(data.error || "Failed to save exam dates.", "error");
            }
        } catch (error) {
            console.error(error);
            toast(`Failed to save dates: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setSavingDates(false);
        }
    };

    const handleSaveInfo = async () => {
        if (!course?.semester?.start_date || !course?.semester?.end_date) {
            toast("Set semester start and end dates first, then edit course metadata.", "error");
            return;
        }

        setSavingInfo(true);
        try {
            const compiledSchedule = (scheduleDays.length > 0 && scheduleTime && scheduleEndTime)
                ? `${scheduleDays.join("/")} ${scheduleTime}-${scheduleEndTime}`
                : "";

            const res = await fetchWithRetry(`/api/planner/courses/${course.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    instructor_name: instructorName || null,
                    location: location || null,
                    class_schedule: compiledSchedule || "",
                    final_mark: finalMark === "" ? null : finalMark,
                    status: courseStatus
                }),
                retries: 2
            });

            if (res.ok) {
                const data = await res.json() as { xpEarned?: number };
                if (data.xpEarned && data.xpEarned > 0) {
                    toast(`Course Completed! Earned ${data.xpEarned} XP.`, "success");
                } else {
                    toast("Course info saved successfully!", "success");
                }
            } else {
                const data = await res.json().catch(() => ({} as { error?: string }));
                toast(data.error || "Failed to save course info.", "error");
            }
        } catch (error) {
            console.error(error);
            toast(`Failed to save course info: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setSavingInfo(false);
        }
    };

    if (loading || !course) {
        return (
            <div className="min-h-screen bg-[#edf1f6] flex items-center justify-center">
                <div className="w-8 h-8 rounded-xl bg-white animate-pulse" />
            </div>
        );
    }

    const hasSemesterDateRange = Boolean(course.semester?.start_date) && Boolean(course.semester?.end_date);

    return (
        <div className="min-h-screen bg-[#edf1f6] text-[#222d32] selection:bg-[#dc4835]/30 font-sans pb-24">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec] px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href={`/planner/semesters/${course.semester_id}`} className="p-2 -ml-2 hover:bg-[#edf1f6] rounded-xl transition-all group">
                            <ArrowLeft className="w-5 h-5 text-[#5a6472] group-hover:text-[#222d32]" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                                {course.name}
                            </h1>
                            <p className="text-xs text-[#5a6472] font-bold uppercase tracking-widest leading-none mt-1">
                                {course.code} • {course.credits} CH
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Study Log & Details */}
                    {/* Left Column - Setup & Log */}
                    <div className="lg:col-span-1 space-y-6">

                        {/* Exam Dates - High Prominence */}
                        <div className={`bg-white p-6 rounded-4xl border transition-all duration-500 ${!midtermDate || !finalDate ? 'border-[#dc4835]/40 shadow-[0_0_20px_rgba(220,72,53,0.1)]' : 'border-[#dde3ec]'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a6472] flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4" /> Exam Schedule
                                </h2>
                                {(!midtermDate || !finalDate) && (
                                    <span className="text-xs bg-[#dc4835]/10 text-[#dc4835] px-2 py-0.5 rounded-full font-bold animate-pulse">Needs Setup</span>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="midtermDate" className="text-xs font-bold text-[#5a6472]">Midterm Date & Time</label>
                                    <input
                                        id="midtermDate" type="datetime-local" value={midtermDate} onChange={e => setMidtermDate(e.target.value)}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-[#dc4835] transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="finalDate" className="text-xs font-bold text-[#5a6472]">Final Date & Time</label>
                                    <input
                                        id="finalDate" type="datetime-local" value={finalDate} onChange={e => setFinalDate(e.target.value)}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-[#dc4835] transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveDates} disabled={savingDates}
                                    className="w-full py-3 bg-[#dc4835] hover:bg-[#c03d2e] disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {savingDates ? 'Saving...' : 'Save Schedule'}
                                    {!savingDates && <Save className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Course Info */}
                        <div className={`bg-white p-6 rounded-4xl border transition-all duration-500 ${!instructorName || !location || !(scheduleDays.length > 0 && scheduleTime) ? 'border-emerald-500/30' : 'border-[#dde3ec]'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a6472] flex items-center gap-2">
                                    <Info className="w-4 h-4" /> Course Details
                                </h2>
                            </div>

                            {!hasSemesterDateRange && (
                                <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
                                    Set semester start and end dates first to unlock course metadata and calendar schedule sync.
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="instructorName" className="text-xs font-bold text-[#5a6472]">Instructor Name</label>
                                    <input
                                        id="instructorName" type="text" value={instructorName} onChange={e => setInstructorName(e.target.value)} placeholder="e.g. Dr. Smith" disabled={!hasSemesterDateRange}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label htmlFor="location" className="text-xs font-bold text-[#5a6472]">Location</label>
                                        <input
                                            id="location" type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Room 302" disabled={!hasSemesterDateRange}
                                            className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="courseStatus" className="text-xs font-bold text-[#5a6472]">Course Status</label>
                                        <select
                                            id="courseStatus" value={courseStatus} onChange={e => setCourseStatus(e.target.value)} disabled={!hasSemesterDateRange}
                                            className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 transition-colors appearance-none"
                                        >
                                            <option value="planned" className="bg-white text-[#222d32]">Planned</option>
                                            <option value="in_progress" className="bg-white text-[#222d32]">In Progress</option>
                                            <option value="completed" className="bg-white text-[#222d32]">Completed</option>
                                            <option value="dropped" className="bg-white text-[#222d32]">Dropped</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <span className="text-xs font-bold text-[#5a6472] block">Class Schedule</span>

                                    {/* Days Toggle */}
                                    <div className="flex flex-wrap gap-2">
                                        {ALL_DAYS.map(day => {
                                            const isActive = scheduleDays.includes(day);
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    disabled={!hasSemesterDateRange}
                                                    onClick={() => {
                                                        if (isActive) setScheduleDays(scheduleDays.filter(d => d !== day));
                                                        else setScheduleDays([...scheduleDays, day]);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-emerald-500 text-black shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-[#edf1f6] text-[#5a6472] hover:bg-[#edf1f6] hover:text-[#222d32]'}`}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Time Picker */}
                                    <div className="flex items-center gap-3">
                                        <Clock className="w-4 h-4 text-[#5a6472]" />
                                        <input
                                            id="scheduleTime" type="time" title="Schedule Start Time"
                                            value={scheduleTime}
                                            disabled={!hasSemesterDateRange}
                                            onChange={e => setScheduleTime(e.target.value)}
                                            className="flex-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 transition-colors"
                                        />
                                        <span className="text-[#5a6472] text-xs">to</span>
                                        <input
                                            id="scheduleEndTime" type="time" title="Schedule End Time"
                                            value={scheduleEndTime}
                                            disabled={!hasSemesterDateRange}
                                            onChange={e => setScheduleEndTime(e.target.value)}
                                            className="flex-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="finalMark" className="text-xs font-bold text-[#5a6472]">Final Expected Mark (0-100)</label>
                                    <input
                                        id="finalMark" type="number" value={finalMark} onChange={e => setFinalMark(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 95" disabled={!hasSemesterDateRange}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <button
                                    onClick={handleSaveInfo} disabled={savingInfo || !hasSemesterDateRange}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {savingInfo ? 'Saving...' : 'Save Meta Data'}
                                    {!savingInfo && <Save className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Log Session */}
                        <div className="bg-white p-6 rounded-4xl border border-[#dde3ec]">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a6472] mb-4 flex items-center gap-2">
                                <PlayCircle className="w-4 h-4" /> Log Session
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="duration" className="text-xs font-bold text-[#5a6472]">Duration (Minutes)</label>
                                    <input
                                        id="duration" type="number" value={duration} onChange={e => setDuration(Number(e.target.value))}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="sessionType" className="text-xs font-bold text-[#5a6472]">Activity Type</label>
                                    <select
                                        id="sessionType" value={sessionType} onChange={e => setSessionType(e.target.value)}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-colors appearance-none"
                                    >
                                        <option value="reading" className="bg-white text-[#222d32]">Reading / Lecturing</option>
                                        <option value="practice" className="bg-white text-[#222d32]">Practice / Homework</option>
                                        <option value="project" className="bg-white text-[#222d32]">Project Work</option>
                                        <option value="review" className="bg-white text-[#222d32]">Exam Review</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="sessionNotes" className="text-xs font-bold text-[#5a6472]">Optional Notes</label>
                                    <textarea
                                        id="sessionNotes" value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} rows={2}
                                        placeholder="What did you focus on?"
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-blue-500 transition-colors resize-none"
                                    />
                                </div>
                                <button
                                    onClick={handleLogSession} disabled={logging}
                                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {logging ? 'Logging...' : 'Log Study Time'}
                                    {!logging && <CheckCircle2 className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Recent Sessions */}
                        <div className="bg-white p-6 rounded-4xl border border-[#dde3ec]">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a6472] mb-4 flex items-center gap-2">
                                <History className="w-4 h-4" /> Recent Logs
                            </h2>
                            <div className="space-y-3">
                                {sessions.length > 0 ? sessions.map((s) => (
                                    <div key={s.id || `schedule-item-${Date.now()}-${Math.random().toString(36).substring(7)}`} className="flex justify-between items-center bg-[#edf1f6] p-3 rounded-xl text-sm">
                                        <span className="capitalize font-semibold text-[#222d32]">{s.type}</span>
                                        <span className="text-[#5a6472] font-medium font-mono">{s.duration_minutes}m</span>
                                    </div>
                                )) : (
                                    <p className="text-[#5a6472] text-xs italic text-center py-4">No sessions logged yet.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Notes Wrapper */}
                    <div className="lg:col-span-2 bg-white rounded-4xl border border-[#dde3ec] overflow-hidden flex flex-col min-h-125">
                        <div className="p-4 border-b border-[#dde3ec] flex items-center justify-between">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a6472] flex items-center gap-2">
                                <BookOpen className="w-4 h-4" /> Second Brain Notes
                            </h2>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#edf1f6]">
                            <CourseNotesEditor
                                courseTitle={course.name || course.code}
                                value={courseContent ?? course.course_notes?.[0]?.content ?? "<p></p>"}
                                onAutoSave={handleAutoSaveNotes}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
