"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session-stub";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Plus, ArrowRight, BookOpen, Clock, Target, Settings2 } from "lucide-react";
import Link from "next/link";
import { fetchJSON } from "@/lib/fetch-retry";
import SemesterSetupWizard from "./SemesterSetupWizard";
import { calculateSemesterGpa } from "@/lib/grading";

interface SemesterCourse {
    grade_point: number | null;
    grade_letter: string | null;
    credits: number;
}

interface SemesterItem {
    id: number;
    type: string;
    year: number;
    name: string;
    end_date: string | null;
    semester_gpa: number | null;
    courses?: SemesterCourse[];
}

export default function PlannerSemesterList() {
    const { status } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [semesters, setSemesters] = useState<SemesterItem[]>([]);
    const [showWizard, setShowWizard] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchSemesters();
        }
    }, [status, router]);

    const fetchSemesters = async () => {
        try {
            setLoading(true);
            const data = await fetchJSON<{ semesters?: SemesterItem[] }>("/api/planner/semesters", { retries: 2 });
            setSemesters(data.semesters || []);
        } catch (error: unknown) {
            console.error("Failed to load semesters:", error instanceof Error ? error.message : String(error));
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#edf1f6] flex items-center justify-center">
                <div className="w-8 h-8 rounded-xl bg-white animate-pulse" />
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24 bg-[#edf1f6] text-[#222d32] selection:bg-[#dc4835]/30">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec] px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
                <div className="flex flex-col min-w-0">
                    <Link href="/planner" className="text-xs text-[#5a6472] uppercase tracking-widest font-bold hover:text-[#222d32] transition-colors mb-1 flex items-center gap-1">
                        ← Dashboard
                    </Link>
                    <h1 className="font-bold text-base sm:text-lg flex items-center gap-2 truncate">
                        <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5 text-[#dc4835] shrink-0" /> <span className="truncate">All Semesters</span>
                    </h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <Link href="/planner/settings" className="hidden sm:flex p-2 rounded-xl bg-[#edf1f6] hover:bg-[#edf1f6] text-[#5a6472] transition-colors" title="Settings">
                        <Settings2 className="w-4 h-4" />
                    </Link>
                    <Link href="/" className="hidden sm:flex px-3 sm:px-4 py-2 rounded-xl bg-[#edf1f6] hover:bg-[#edf1f6] text-xs font-semibold text-[#5a6472] transition-colors whitespace-nowrap">
                        Course Tracker
                    </Link>
                </div>
            </header>

            <main className="max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 md:px-6 pt-8">

                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black font-display tracking-tight">Timeline</h2>
                        <p className="text-[#5a6472] text-sm mt-1">Manage your active and completed semesters.</p>
                    </div>
                    <button
                        onClick={() => setShowWizard(true)}
                        className="px-4 py-2 bg-[#edf1f6] hover:bg-[#edf1f6] border border-[#dde3ec] rounded-xl text-sm font-semibold flex items-center gap-2 transition-all group"
                    >
                        <Plus className="w-4 h-4 text-[#5a6472] group-hover:text-[#222d32]" />
                        Add Term
                    </button>
                </div>

                <div className="space-y-4">
                    <AnimatePresence>
                        {semesters.map((sem, i) => {
                            const courseCount = sem.courses?.length || 0;
                            const todayAmman = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Amman" }));
                            todayAmman.setHours(0, 0, 0, 0);

                            // A semester is past/completed if its end date has passed (is before or equal to today)
                            // Normalize the end date to midnight for proper comparison
                            let isPast = false;
                            if (sem.end_date) {
                                const endDate = new Date(sem.end_date);
                                endDate.setHours(0, 0, 0, 0);
                                isPast = endDate < todayAmman;
                            }

                            // Calculate dynamic GPA if not officially set
                            let gpa = sem.semester_gpa ?? 0;
                            if (sem.semester_gpa === null && sem.courses && sem.courses.length > 0) {
                                gpa = calculateSemesterGpa(sem.courses.map(c => ({
                                    grade: c.grade_letter || "",
                                    credits: c.credits
                                })));
                            }

                            return (
                                <motion.div
                                    key={sem.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="group relative bg-white border border-[#dde3ec] hover:border-[#dc4835]/30 rounded-3xl p-6 transition-colors overflow-hidden flex flex-col sm:flex-row gap-6 justify-between items-start sm:items-center"
                                >
                                    <div className="flex items-start gap-4 z-10">
                                        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center border ${isPast ? 'bg-[#edf1f6] border-[#dde3ec] text-[#5a6472]' : 'bg-[#dc4835]/10 border-[#dc4835]/30 text-[#dc4835]'}`}>
                                            <span className="text-xs font-bold uppercase">{sem.type.substring(0, 3)}</span>
                                            <span className="text-lg font-black leading-none">{sem.year}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-xl font-bold">{sem.name}</h3>
                                                {isPast && <span className="px-2 py-0.5 rounded-md bg-[#edf1f6] text-xs text-[#5a6472] font-bold uppercase">Completed</span>}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-[#5a6472]">
                                                <span className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> {courseCount} Courses</span>
                                                <span className="hidden sm:flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> GPA: {gpa > 0 ? gpa.toFixed(2) : '-.-'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto z-10 flex sm:justify-end">
                                        <Link
                                            href={`/planner/semesters/${sem.id}`}
                                            className="w-full sm:w-auto px-6 py-3 bg-[#edf1f6] hover:bg-[#edf1f6] rounded-xl text-sm font-bold flex items-center justify-center sm:justify-between gap-3 transition-colors text-[#222d32] group-hover:text-[#222d32]"
                                        >
                                            View Semester <ArrowRight className="w-4 h-4 text-[#5a6472] group-hover:text-[#222d32] group-hover:translate-x-1 transition-all" />
                                        </Link>
                                    </div>

                                    {/* Hover gradient effect */}
                                    <div className="absolute inset-0 bg-linear-to-r from-transparent via-[#dc4835]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>

                    {semesters.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center justify-center border-2 border-dashed border-[#dde3ec] rounded-3xl bg-[#edf1f6]">
                            <Clock className="w-10 h-10 text-[#5a6472] mb-4" />
                            <h3 className="text-lg font-bold mb-1">No Semesters Found</h3>
                            <p className="text-[#5a6472] text-sm">Create your first term to begin tracking.</p>
                        </div>
                    )}
                </div>

            </main>

            <AnimatePresence>
                {showWizard && (
                    <SemesterSetupWizard
                        onClose={() => setShowWizard(false)}
                        onComplete={() => { setShowWizard(false); fetchSemesters(); }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

