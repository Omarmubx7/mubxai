"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session-stub";
import { useRouter } from "next/navigation";
import { BookOpen, Clock, TrendingUp, Calendar as CalendarIcon, PlayCircle, Settings } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchJSON } from "@/lib/fetch-retry";
import LogSessionModal from "./modals/LogSessionModal";

interface StudySessionItem {
    id: number;
    created_at: string;
    duration_minutes: number;
    notes: string | null;
    course: {
        name: string;
    };
}

interface NeglectedCourseInfo {
    last_studied: string | null;
    course: {
        name: string;
    };
}

interface StudyLogStats {
    total_study_minutes: number;
    study_sessions: StudySessionItem[];
    neglected_course: NeglectedCourseInfo | null;
}

interface PlannerSummaryResponse {
    studyLogStats?: StudyLogStats;
    currentSemester?: {
        courses: Array<{ id: number; code: string; name: string }>;
    };
}

export default function PlannerStudyLogClient() {
    const { status } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<PlannerSummaryResponse | null>(null);
    const [isLogSessionOpen, setIsLogSessionOpen] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchStudyLogInfo();
        }
    }, [status, router]);

    const fetchStudyLogInfo = async () => {
        try {
            setLoading(true);
            const data = await fetchJSON<PlannerSummaryResponse>("/api/planner/summary", { retries: 2 });
            console.log("[StudyLog] API response:", { 
                hasStudyLogStats: !!data.studyLogStats, 
                totalMinutes: data.studyLogStats?.total_study_minutes,
                sessionCount: data.studyLogStats?.study_sessions?.length
            });
            setStats(data);
        } catch (error) {
            console.error("Failed to load study log", error);
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

    const { study_sessions, neglected_course } = stats?.studyLogStats || { study_sessions: [], neglected_course: null };

    return (
        <div className="min-h-screen pb-24 bg-[#edf1f6] text-[#222d32] selection:bg-[#dc4835]/30 overflow-hidden">
            <LogSessionModal
                isOpen={isLogSessionOpen}
                onClose={() => setIsLogSessionOpen(false)}
                courses={stats?.currentSemester?.courses || []}
                onSuccess={() => fetchStudyLogInfo()}
            />
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec] px-6 py-4 flex items-center justify-between">
                <div className="flex flex-col">
                    <Link href="/planner" className="text-xs text-[#5a6472] uppercase tracking-widest font-bold hover:text-[#dc4835] transition-colors mb-1 flex items-center gap-1">
                        ← Dashboard
                    </Link>
                    <h1 className="font-bold text-lg flex items-center gap-2">
                        <PlayCircle className="w-5 h-5 text-emerald-400" /> Study Log
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <Link href="/planner/settings" className="p-2 rounded-xl bg-[#edf1f6] hover:bg-[#edf1f6] text-[#5a6472] transition-colors">
                        <Settings className="w-4 h-4" />
                    </Link>
                    <Link href="/" className="px-4 py-2 rounded-xl bg-[#edf1f6] hover:bg-[#edf1f6] text-xs font-semibold sm:text-sm text-[#5a6472] transition-colors">
                        Course Tracker
                    </Link>
                </div>
            </header>

            <main className="max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 md:px-6 pt-8 space-y-6">
                <div>
                    <h2 className="text-2xl font-black font-display tracking-tight">Focus & Tracking</h2>
                    <p className="text-[#5a6472] text-sm mt-1">Review your recent study sessions and identify areas needing attention.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-[#dde3ec]">
                    {/* Time Logged Card */}
                    <div className="glass-panel p-6 rounded-[2rem] border border-[#dde3ec] bg-[#edf1f6]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-blue-400" />
                            </div>
                            <h3 className="font-bold text-lg">Total Time Streamed</h3>
                        </div>
                        <div className="text-4xl font-black tabular-nums">
                            {Math.floor((stats?.studyLogStats?.total_study_minutes || 0) / 60)}<span className="text-lg text-[#5a6472] font-bold ml-1">hrs</span>
                            {' '}
                            {(stats?.studyLogStats?.total_study_minutes || 0) % 60}<span className="text-lg text-[#5a6472] font-bold ml-1">mins</span>
                        </div>
                    </div>

                    {/* Neglected Course Insight */}
                    <div className="premium-card p-6 flex flex-col justify-between">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-rose-400" />
                            </div>
                            <h3 className="font-bold text-lg">Most Neglected</h3>
                        </div>
                        {neglected_course ? (
                            <div className="mt-2">
                                <p className="text-sm text-[#5a6472] mb-1">Needs attention soon:</p>
                                <p className="text-xl font-bold bg-clip-text text-transparent bg-linear-to-r from-rose-400 to-orange-400">
                                    {neglected_course.course.name}
                                </p>
                                <p className="text-[11px] font-bold text-[#5a6472] uppercase tracking-widest mt-2">
                                    Last studied: {neglected_course.last_studied ? new Date(neglected_course.last_studied).toLocaleDateString() : 'Never'}
                                </p>
                            </div>
                        ) : (
                            <p className="text-[#5a6472] text-sm italic mt-4">All tracked courses have recent activity.</p>
                        )}
                    </div>
                </div>

                {/* Session History */}
                <div>
                    <div className="flex items-center justify-between border-b border-[#dde3ec] pb-2 mb-4 mt-8">
                        <h3 className="text-lg font-bold font-display tracking-tight flex items-center gap-2">
                            <CalendarIcon className="w-5 h-5 text-[#dc4835]" /> Session History
                        </h3>
                        <button
                            onClick={() => setIsLogSessionOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold transition-colors shadow-[0_0_10px_rgba(37,99,235,0.3)] text-white"
                        >
                            <PlayCircle className="w-4 h-4" /> Log Time
                        </button>
                    </div>

                    <div className="space-y-3">
                        {study_sessions.length > 0 ? (
                            study_sessions.map((session: StudySessionItem, index: number) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    key={session.id}
                                    className="p-4 bg-[#edf1f6] border border-[#dde3ec] rounded-2xl flex items-center justify-between group hover:bg-[#edf1f6] hover:border-[#dde3ec] transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-[#edf1f6] flex flex-col items-center justify-center text-[#5a6472] font-bold">
                                            <span className="text-xs uppercase leading-none">{new Date(session.created_at).toLocaleDateString('en-US', { month: 'short' })}</span>
                                            <span className="text-sm leading-none mt-0.5">{new Date(session.created_at).getDate()}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-[#222d32] group-hover:text-[#222d32] transition-colors">
                                                {session.course.name}
                                            </p>
                                            <p className="text-[11px] text-[#5a6472] uppercase tracking-wider font-bold mt-1">
                                                {session.notes || "No notes attached"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-emerald-400">+{session.duration_minutes}m</p>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="py-12 text-center rounded-3xl border border-dashed border-[#dde3ec]">
                                <BookOpen className="w-8 h-8 text-[#5a6472] mx-auto mb-3" />
                                <p className="text-sm font-semibold text-[#5a6472]">No study sessions recorded yet.</p>
                                <button
                                    onClick={() => setIsLogSessionOpen(true)}
                                    className="px-6 py-2.5 mt-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-sm text-white transition-colors inline-block shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                                >
                                    Log your first session
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
