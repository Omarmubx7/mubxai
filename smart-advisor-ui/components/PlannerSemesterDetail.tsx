"use client";

import { useState, useEffect, useCallback, memo, useRef } from "react";
import { useSession } from "@/lib/session-stub";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen, Plus, MapPin, User, Save, ArrowRight, Search, Calendar as CalendarIcon, Edit2, Trash2, FileText, ChevronRight, Settings2, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useToast } from "./ui/Toast";
import ConfirmDialog from "./ui/ConfirmDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchWithRetry, fetchJSON } from "@/lib/fetch-retry";
import { GRADE_MAP } from "@/lib/grading";
import AddCourseModal from "./modals/AddCourseModal";
import CourseSettingsModal from "./modals/CourseSettingsModal";

interface PlannerSemesterDetailProps {
    semesterId: string;
}

interface PlannerCourseItem {
    id: number;
    code: string;
    name: string;
    credits: number;
    grade_letter?: string | null;
    grade_point?: number | null;
    instructor_name?: string | null;
    location?: string | null;
    [key: string]: unknown;
}

interface SemesterNoteItem {
    id: number;
    title: string;
    notes?: string | null;
    content?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

interface SemesterDetail {
    id: number;
    name: string;
    type: string;
    year: number;
    semester_gpa?: number | null;
    start_date?: string | null;
    end_date?: string | null;
    courses: PlannerCourseItem[];
}

function GradeLegendPopover({ onClose }: Readonly<{ onClose: () => void }>) {
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        dialogRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-8 left-0 z-50 bg-[#edf1f6] border border-[#dde3ec] rounded-2xl p-3 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.3)]"
            style={{ minWidth: '240px' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Grading scale legend"
            tabIndex={-1}
            ref={dialogRef}
        >
            <h4 className="text-xs font-bold text-[#222d32] mb-3 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-400" />
                Grading Scale
            </h4>
            <div className="space-y-2">
                {Object.entries(GRADE_MAP).slice(0, 4).map(([grade, info]) => (
                    <div key={grade} className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#222d32]">{grade} = {info.label}</span>
                        <span className="text-[#5a6472] text-xs">{info.points} pts</span>
                    </div>
                ))}
            </div>
            <button
                onClick={onClose}
                className="mt-3 w-full py-1.5 text-xs font-bold text-[#5a6472] hover:text-[#222d32] transition-colors"
            >
                Close
            </button>
        </motion.div>
    );
}

function PlannerSemesterDetail({ semesterId }: Readonly<PlannerSemesterDetailProps>) {
    const { status } = useSession();
    const router = useRouter();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [semester, setSemester] = useState<SemesterDetail | null>(null);
    const [courses, setCourses] = useState<PlannerCourseItem[]>([]);

    // Add manual course modal
    const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);

    // Edit course settings modal
    const [isCourseSettingsOpen, setIsCourseSettingsOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<PlannerCourseItem | null>(null);

    // Semester Dates State
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [savingDates, setSavingDates] = useState(false);

    // Semester Notes State
    const [notes, setNotes] = useState<SemesterNoteItem[]>([]);
    const [showNoteModal, setShowNoteModal] = useState(false);
    const [editingNote, setEditingNote] = useState<SemesterNoteItem | null>(null);
    const [noteDraft, setNoteDraft] = useState({ title: "", notes: "" });

    // Confirm Dialog States
    const [showDeleteNoteConfirm, setShowDeleteNoteConfirm] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState<number | null>(null);
    const [showDeleteCourseConfirm, setShowDeleteCourseConfirm] = useState(false);
    const [courseToDelete, setCourseToDelete] = useState<number | null>(null);
    // Grade Legend State
    const [gradeLegendCourseId, setGradeLegendCourseId] = useState<number | null>(null);
    const fetchNotes = useCallback(async () => {
        try {
            const data = await fetchJSON<{ notes: SemesterNoteItem[] }>(`/api/planner/semesters/${semesterId}/notes`, { retries: 2 });
            setNotes(data.notes || []);
        } catch (error) {
            console.error("Failed to fetch notes", error);
            toast("Could not load notes", "error");
        }
    }, [semesterId, toast]);

    const fetchSemester = useCallback(async () => {
        try {
            setLoading(true);
            const [res, currRes] = await Promise.all([
                fetchWithRetry("/api/planner/semesters", { retries: 2 }),
                fetchWithRetry("/data/curriculum.json", { retries: 2 })
            ]);

            if (!res.ok) throw new Error("Failed fetching semesters");

            if (!res.ok) throw new Error("Failed fetching semesters");

            const data = await res.json() as { semesters: SemesterDetail[] };
            const found = data.semesters.find((s) => s.id.toString() === semesterId);

            if (found) {
                setSemester(found);
                if (found.start_date) setStartDate(new Date(found.start_date).toISOString().slice(0, 10));
                if (found.end_date) setEndDate(new Date(found.end_date).toISOString().slice(0, 10));
                setCourses(found.courses || []);
            } else {
                toast("Semester not found.", "error");
                router.push("/planner/semesters");
            }
        } catch (error) {
            console.error(error);
            toast(`Failed to load semester: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setLoading(false);
        }
    }, [semesterId, router, toast]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchSemester();
            fetchNotes();
        }
    }, [status, router, fetchSemester, fetchNotes]);



    const handleSaveNote = async () => {
        if (!noteDraft.title) return;
        try {
            const method = editingNote ? "PATCH" : "POST";
            const body = editingNote ? { ...noteDraft, id: editingNote.id } : noteDraft;
            const res = await fetchWithRetry(`/api/planner/semesters/${semesterId}/notes`, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                retries: 2
            });

            if (res.ok) {
                const data = await res.json();
                if (editingNote) {
                    setNotes(notes.map(n => n.id === editingNote.id ? data.note : n));
                } else {
                    setNotes([data.note, ...notes]);
                }
                setShowNoteModal(false);
                setEditingNote(null);
                setNoteDraft({ title: "", notes: "" });
                toast("Note saved!", "success");
            }
        } catch (error) {
            toast(`Failed to save note: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        }
    };

    const confirmDeleteNote = (id: number) => {
        setNoteToDelete(id);
        setShowDeleteNoteConfirm(true);
    };

    const handleDeleteNote = async () => {
        if (!noteToDelete) return;
        try {
            const res = await fetchWithRetry(`/api/planner/semesters/${semesterId}/notes?id=${noteToDelete}`, { 
                method: "DELETE",
                retries: 1
            });
            if (res.ok) {
                setNotes(notes.filter(n => n.id !== noteToDelete));
                toast("Note deleted.", "success");
            }
        } catch (error) {
            toast(`Failed to delete note: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        }
        setShowDeleteNoteConfirm(false);
        setNoteToDelete(null);
    };

    const handleUpdateGrade = async (courseId: number, grade: string) => {
        try {
            const gradeInfo = GRADE_MAP[grade];
            const res = await fetchWithRetry(`/api/planner/courses/${courseId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    grade_letter: grade,
                    grade_point: gradeInfo ? gradeInfo.points : null,
                    is_completed: !!gradeInfo
                }),
                retries: 2
            });

            if (res.ok) {
                const data = await res.json();
                setCourses(courses.map(c => c.id === courseId ? data.course : c));
            }
        } catch (error) {
            toast(`Failed to update grade: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        }
    };

    const _confirmDeleteCourse = (courseId: number) => {
        setCourseToDelete(courseId);
        setShowDeleteCourseConfirm(true);
    };

    const handleDeleteCourse = async () => {
        if (!courseToDelete) return;
        try {
            const res = await fetchWithRetry(`/api/planner/courses/${courseToDelete}`, { 
                method: "DELETE",
                retries: 1
            });
            if (res.ok) {
                setCourses(courses.filter(c => c.id !== courseToDelete));
                toast("Course deleted.", "success");
            }
        } catch (error) {
            toast(`Failed to delete course: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        }
        setShowDeleteCourseConfirm(false);
        setCourseToDelete(null);
    };

    const handleSaveSemesterDates = async () => {
        setSavingDates(true);
        try {
            const res = await fetchWithRetry(`/api/planner/semesters/${semesterId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    start_date: startDate || null,
                    end_date: endDate || null
                }),
                retries: 2
            });

            if (res.ok) {
                toast("Semester dates saved successfully!", "success");
            } else {
                toast("Failed to save dates.", "error");
            }
        } catch (error) {
            toast(`Failed to save dates: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setSavingDates(false);
        }
    };

    // Calculate dynamic GPA for this view
    const calculateLiveGPA = () => {
        let totalPoints = 0;
        let totalCredits = 0;
        courses.forEach(c => {
            if (typeof c.grade_point === 'number' && c.grade_letter) {
                totalPoints += (c.grade_point * c.credits);
                totalCredits += c.credits;
            }
        });
        return totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '-.--';
    };

    if (loading || !semester) {
        return (
            <div className="min-h-screen bg-[#edf1f6] flex items-center justify-center">
                <div className="w-8 h-8 rounded-xl bg-[#edf1f6] animate-pulse" />
            </div>
        );
    }

    const liveGPA = calculateLiveGPA();

    return (
        <div className="min-h-screen bg-[#edf1f6] text-[#222d32] selection:bg-[#dc4835]/30 font-sans pb-36">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec] px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/planner/semesters" className="p-2 -ml-2 hover:bg-[#edf1f6] rounded-xl transition-all group">
                            <ArrowLeft className="w-5 h-5 text-[#5a6472] group-hover:text-[#222d32]" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
                                {semester.name}
                            </h1>
                            <p className="text-xs text-[#5a6472] font-bold uppercase tracking-widest leading-none mt-1">
                                {semester.type} {semester.year}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <Link href="/planner/settings" className="p-2 rounded-xl bg-[#edf1f6] hover:bg-[#edf1f6] text-[#5a6472] transition-colors">
                            <Settings2 className="w-4 h-4" />
                        </Link>
                        <Link href="/" className="px-4 py-2 rounded-xl bg-[#edf1f6] hover:bg-[#edf1f6] text-xs font-semibold sm:text-sm text-[#5a6472] transition-colors">
                            Course Tracker
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white group">
                        <p className="text-[#5a6472] text-xs font-bold uppercase tracking-widest font-display flex items-center justify-between">
                            <span>Term GPA</span>
                            {semester.semester_gpa !== null && (
                                <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10">Official</span>
                            )}
                        </p>
                        <h2 className="text-4xl font-black mt-2 text-transparent bg-clip-text bg-linear-to-r from-[#dc4835] to-blue-400">
                            {semester.semester_gpa == null ? liveGPA : semester.semester_gpa.toFixed(2)}
                        </h2>
                        {semester.semester_gpa != null && (
                            <p className="text-xs text-[#5a6472] mt-2 font-medium italic">Calculated: {liveGPA}</p>
                        )}
                    </div>
                    <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white">
                        <p className="text-[#5a6472] text-xs font-bold uppercase tracking-widest font-display">Hours Registered</p>
                        <h2 className="text-4xl font-black mt-2 text-[#222d32]">
                            {courses.reduce((acc, c) => acc + c.credits, 0)} <span className="text-lg text-[#5a6472]">CH</span>
                        </h2>
                    </div>
                    <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white flex items-center justify-center">
                        <button
                            onClick={() => setIsAddCourseOpen(true)}
                            className="w-full h-full min-h-25 border-2 sm:border-dashed border-[#dc4835]/30 sm:border-[#dde3ec] hover:border-[#dc4835]/50 hover:bg-[#dc4835]/5 bg-[#dc4835]/10 sm:bg-transparent rounded-3xl transition-all flex flex-col items-center justify-center text-[#dc4835] sm:text-[#5a6472] hover:text-[#222d32] group"
                        >
                            <Plus className="w-6 h-6 mb-2 group-hover:scale-110 transition-transform" />
                            <span className="font-bold text-sm tracking-tight">Add Course</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4">Enrolled Courses</h3>

                    {courses.map(course => {
                        const gradeStyles: Record<string, string> = {
                            D: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                            M: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                            P: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                            U: 'bg-red-500/10 text-red-400 border-red-500/20'
                        };
                        const gradeClassName = gradeStyles[course.grade_letter ?? ''] ?? 'bg-[#edf1f6] text-[#5a6472] border-[#dde3ec]';

                        return (
                        <div key={course.id} className="group bg-white border border-[#dde3ec] rounded-2xl p-4 sm:p-5 hover:border-[#dde3ec] transition-all flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center relative overflow-hidden">
                            <div className="flex items-start gap-4 z-10">
                                <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-sm">
                                    {course.code.substring(0, 2)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-base hover:text-blue-400 transition-colors">
                                        <Link href={`/planner/courses/${course.id}`}>{course.name}</Link>
                                    </h4>
                                    <p className="text-[11px] font-bold tracking-wider text-[#5a6472] uppercase mt-0.5">{course.code} • {course.credits} CH</p>

                                    <div className="flex gap-4 mt-3">
                                        {course.instructor_name && (
                                            <span className="flex items-center gap-1 text-xs text-[#5a6472]"><User className="w-3.5 h-3.5" /> {course.instructor_name}</span>
                                        )}
                                        {course.location && (
                                            <span className="flex items-center gap-1 text-xs text-[#5a6472]"><MapPin className="w-3.5 h-3.5" /> {course.location}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-4 z-10 pt-4 sm:pt-0 border-t border-[#dde3ec] sm:border-0 mt-2 sm:mt-0">
                                <div className="flex flex-col items-start sm:items-end relative">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label htmlFor={`grade-${course.id}`} className="text-xs uppercase font-bold text-[#5a6472] tracking-widest pl-1">Grade</label>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setGradeLegendCourseId((current) => current === course.id ? null : course.id); }}
                                            className="p-0.5 hover:bg-[#edf1f6] rounded-full transition-colors"
                                            title="View grading scale"
                                        >
                                            <HelpCircle className="w-3.5 h-3.5 text-cyan-400/60 hover:text-cyan-400" />
                                        </button>
                                        <AnimatePresence>
                                            {gradeLegendCourseId === course.id && (
                                                <GradeLegendPopover onClose={() => setGradeLegendCourseId(null)} />
                                            )}
                                        </AnimatePresence>
                                    </div>
                                    <div className="relative group/select">
                                        <select
                                            id={`grade-${course.id}`}
                                            value={course.grade_letter || ""}
                                            onChange={(e) => handleUpdateGrade(course.id, e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        >
                                            <option value="" className="bg-white text-[#222d32]">-</option>
                                            <option value="D" className="bg-white text-[#222d32]">D</option>
                                            <option value="M" className="bg-white text-[#222d32]">M</option>
                                            <option value="P" className="bg-white text-[#222d32]">P</option>
                                            <option value="U" className="bg-white text-[#222d32]">U</option>
                                        </select>
                                        <div className={`px-4 py-2 flex items-center justify-center rounded-xl font-black text-sm transition-all border ${gradeClassName} group-hover/select:border-[#dde3ec]`}>
                                            {course.grade_letter || "-"}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setEditingCourse(course);
                                            setIsCourseSettingsOpen(true);
                                        }}
                                        className="p-3 bg-[#edf1f6] hover:bg-[#edf1f6] rounded-xl transition-colors"
                                        title="Course Settings"
                                    >
                                        <Settings2 className="w-4 h-4 text-[#5a6472]" />
                                    </button>
                                    <Link
                                        href={`/planner/courses/${course.id}`}
                                        className="p-3 bg-[#edf1f6] hover:bg-[#edf1f6] rounded-xl transition-colors"
                                    >
                                        <ArrowRight className="w-4 h-4 text-[#5a6472]" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                        );
                    })}

                    {courses.length === 0 && (
                        <div className="py-16 flex flex-col items-center justify-center border border-dashed border-[#dde3ec] rounded-3xl text-[#5a6472]">
                            <BookOpen className="w-8 h-8 mb-3 opacity-50" />
                            <p className="text-sm font-semibold">No courses logged for this semester.</p>
                            <button
                                onClick={() => setIsAddCourseOpen(true)}
                                className="p-2 sm:px-4 sm:py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-xs sm:text-sm text-white transition-colors flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                            >
                                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Course</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Semester Notes Section */}
                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#dde3ec] pb-2 mb-4">
                        <h3 className="text-lg font-bold font-display tracking-tight flex items-center gap-2">
                            <FileText className="w-5 h-5 text-emerald-400" /> Semester Notes & Generic Pages
                        </h3>
                        <button
                            onClick={() => {
                                setEditingNote(null);
                                setNoteDraft({ title: "", notes: "" });
                                setShowNoteModal(true);
                            }}
                            className="p-2 hover:bg-[#edf1f6] rounded-lg text-emerald-400 transition-colors flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                        >
                            <Plus className="w-4 h-4" /> New Page
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {notes.map(note => (
                            <div key={note.id} className="glass-panel p-5 rounded-2xl border border-[#dde3ec] bg-white hover:border-[#dde3ec] transition-all flex flex-col justify-between group">
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-bold text-[#222d32] group-hover:text-emerald-400 transition-colors">{note.title}</h4>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingNote(note);
                                                    setNoteDraft({ title: note.title, notes: note.notes || "" });
                                                    setShowNoteModal(true);
                                                }}
                                                className="p-1.5 hover:bg-[#edf1f6] rounded-md text-[#5a6472] hover:text-[#222d32]"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => confirmDeleteNote(note.id)}
                                                className="p-2 text-[#5a6472] hover:text-red-400 hover:bg-[#edf1f6] rounded-xl transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[#5a6472] mt-2 line-clamp-3 leading-relaxed">
                                        {note.notes || "No additional content..."}
                                    </p>
                                </div>
                                <div className="mt-4 pt-4 border-t border-[#dde3ec] flex items-center justify-between">
                                    <span className="text-xs font-bold text-[#5a6472] uppercase tracking-widest">
                                        Last edited: {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : 'N/A'}
                                    </span>
                                    <ChevronRight className="w-4 h-4 text-[#5a6472]" />
                                </div>
                            </div>
                        ))}

                        {notes.length === 0 && (
                            <div className="sm:col-span-2 py-12 flex flex-col items-center justify-center border border-dashed border-[#dde3ec] rounded-3xl text-[#5a6472]">
                                <FileText className="w-8 h-8 mb-3 opacity-30" />
                                <p className="text-sm font-semibold">No generic pages created for this term.</p>
                                <button
                                    onClick={() => setShowNoteModal(true)}
                                    className="mt-4 text-xs font-bold text-emerald-400 hover:underline"
                                >
                                    + Add your first note
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Edit Semester Metadata */}
                <div className="mt-8 glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white max-w-2xl mx-auto">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-[#5a6472] mb-4 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4" /> Term Dates
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="start-date" className="text-xs font-bold text-[#5a6472]">Start Date</label>
                            <input
                                id="start-date"
                                type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-[#dc4835] transition-colors"
                            />
                        </div>
                        <div>
                            <label htmlFor="end-date" className="text-xs font-bold text-[#5a6472]">End Date</label>
                            <input
                                id="end-date"
                                type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:border-[#dc4835] transition-colors"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSaveSemesterDates} disabled={savingDates}
                        className="w-full mt-4 py-3 bg-[#dc4835] hover:bg-[#dc4835]/90 disabled:opacity-50 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        {savingDates ? 'Saving...' : 'Save Semester Dates'}
                        {!savingDates && <Save className="w-4 h-4" />}
                    </button>
                </div>

            </main>

            {/* Add Course Modal */}
            <AddCourseModal
                isOpen={isAddCourseOpen}
                onClose={() => setIsAddCourseOpen(false)}
                semesterId={Number(semesterId)}
                existingCourses={courses}
                onSuccess={() => fetchSemester()}
            />

            {/* Edit Course Settings Modal */}
            <CourseSettingsModal
                isOpen={isCourseSettingsOpen}
                onClose={() => setIsCourseSettingsOpen(false)}
                course={editingCourse as any}
                semesterMeta={{ start_date: startDate, end_date: endDate }}
                onSuccess={(updatedCourse) => {
                    setCourses(courses.map(c => c.id === updatedCourse.id ? (updatedCourse as any) : c));
                }}
            />

            {/* Semester Note Modal */}
            <AnimatePresence>
                {showNoteModal && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center px-4">
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/80 backdrop-blur-sm"
                            onClick={() => setShowNoteModal(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            className="relative w-full max-w-lg bg-white border border-[#dde3ec] rounded-3xl p-6 shadow-2xl"
                        >
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-400" />
                                {editingNote ? 'Edit Semester Note' : 'New Semester Page'}
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="note-title" className="text-xs uppercase text-[#5a6472] tracking-widest font-bold pl-1">Page Title</label>
                                    <input
                                        id="note-title"
                                        type="text" placeholder="e.g. Internship Ideas, Degree Plan..."
                                        value={noteDraft.title} onChange={e => setNoteDraft({ ...noteDraft, title: e.target.value })}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="note-content" className="text-xs uppercase text-[#5a6472] tracking-widest font-bold pl-1">Content / Thoughts</label>
                                    <textarea
                                        id="note-content"
                                        placeholder="Write anything you want to keep track of this semester..."
                                        rows={8}
                                        value={noteDraft.notes} onChange={e => setNoteDraft({ ...noteDraft, notes: e.target.value })}
                                        className="w-full mt-1 bg-white border border-[#dde3ec] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-3 mt-8">
                                <button onClick={() => setShowNoteModal(false)} className="flex-1 py-3 bg-[#edf1f6] hover:bg-[#edf1f6] rounded-xl text-sm font-semibold transition-colors">Cancel</button>
                                <button
                                    onClick={handleSaveNote}
                                    disabled={!noteDraft.title}
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition-colors"
                                >
                                    {editingNote ? 'Update Page' : 'Save Page'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <ConfirmDialog
                isOpen={showDeleteCourseConfirm}
                title="Delete Course?"
                description="Are you sure you want to delete this course and all its notes? This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDeleteCourse}
                onCancel={() => setShowDeleteCourseConfirm(false)}
            />

            <ConfirmDialog
                isOpen={showDeleteNoteConfirm}
                title="Delete Note?"
                description="Are you sure you want to delete this note? This action cannot be reversed."
                confirmLabel="Delete"
                variant="danger"
                onConfirm={handleDeleteNote}
                onCancel={() => setShowDeleteNoteConfirm(false)}
            />
        </div>
    );
}

const PlannerSemesterDetailMemoized = memo(PlannerSemesterDetail);
export default PlannerSemesterDetailMemoized;
