"use client";

import { useState, useEffect, memo, useCallback, useRef } from "react";
import { useSession, signOut } from "@/lib/session-stub";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trophy, Calendar, Sparkles, ChevronRight, LayoutDashboard, Target, ArrowRight, RefreshCcw, ExternalLink, Bell, AlertTriangle, TrendingUp, Settings, Plus, Flame, Clock, HelpCircle, Brain, Search, CalendarDays, Bot } from "lucide-react";
import Link from "next/link";
import PlannerOnboarding from "@/components/PlannerOnboarding";
import { useToast } from "./ui/Toast";
import ThemeToggle from "@/components/ThemeToggle";
import { safeStorage } from "@/lib/safe-storage";
import SemesterSetupWizard from "@/components/SemesterSetupWizard";
import BrandMark from "@/components/BrandMark";
import LogSessionModal from "./modals/LogSessionModal";
import AddCourseModal from "./modals/AddCourseModal";

interface NotificationEvent {
    id: number;
    title: string;
    type: string;
    start_datetime: string;
}

interface QuestItem {
    id: number;
    type: string;
    current_value: number;
    target_value: number;
}

interface StudyTip {
    icon: "clock" | "target" | "flame";
    color: "orange" | "emerald" | "indigo";
    title: string;
    text: string;
}

interface StudyTrendPoint {
    date: string;
    minutes: number;
}

interface PlannerSummary {
    google_calendar_connected?: boolean;
    upcomingEvents?: NotificationEvent[];
    upcomingEventsLabel?: string;
    gamification?: {
        level: number;
        xp: number;
        current_streak_days: number;
    };
    classification?: string;
    cgpa?: number;
    currentSemester?: {
        name: string;
        courses?: Array<unknown>;
    } | null;
    activeQuests?: QuestItem[];
    neglectedCourse?: {
        id: number;
        name: string;
        total_study_minutes: number;
    } | null;
    projections?: {
        distinction?: string;
        merit?: string;
        remainingCH?: number;
    };
    studyTips?: StudyTip[];
    studyTrends?: StudyTrendPoint[];
    user?: {
        major?: string;
    };
}

function StatusExplanationPopover({ classification, onClose }: Readonly<{ classification: string; onClose: () => void }>) {
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

    const explanations: Record<string, { threshold: string; description: string; action: string }> = {
        'EX': {
            threshold: 'GPA 3.6 - 4.0',
            description: 'Excellent performance! You\'re excelling academically.',
            action: 'Keep up this outstanding work!'
        },
        'VG': {
            threshold: 'GPA 3.2 - 3.59',
            description: 'Very Good performance. You\'re doing exceptionally well.',
            action: 'Aim for Distinction with consistent effort!'
        },
        'Good': {
            threshold: 'GPA 2.8 - 3.19',
            description: 'Good academic standing. You\'re performing well.',
            action: 'Focus on consistent study habits to improve further.'
        },
        'SAT': {
            threshold: 'GPA 2.4 - 2.79',
            description: 'Satisfactory performance. You\'re meeting minimum standards.',
            action: 'Increase study time and focus on challenging subjects.'
        },
        'LOW': {
            threshold: 'GPA Below 2.4',
            description: 'Below Minimum threshold. You need to improve your grades significantly.',
            action: 'Seek academic support, increase study hours, and focus on high-credit courses.'
        },
    };

    const info = explanations[classification] || { threshold: 'Unknown', description: 'Status unknown', action: 'Check your grades' };

    return (
        <>
            <button
                type="button"
                className="fixed inset-0 z-40 bg-transparent border-none cursor-default"
                onClick={onClose}
                aria-label="Close academic status popover"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-12 right-0 z-50 bg-white border border-[#dde3ec] rounded-2xl p-4 shadow-lg max-w-[calc(100vw-2rem)] overflow-x-hidden"
                style={{ minWidth: 'min(300px,100%)', maxWidth: 'min(360px,calc(100vw-2rem))' }}
                onClick={(e) => e.stopPropagation()}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Academic status explanation"
                tabIndex={-1}
            >
            <div className="flex items-start justify-between mb-3">
                <h4 className="text-sm font-bold text-[#222d32]">Academic Status</h4>
                <button onClick={onClose} className="shrink-0 p-0.5 hover:bg-[#edf1f6] rounded transition-colors" aria-label="Close academic status popover">
                    <span className="text-sm text-[#5a6472]">✕</span>
                </button>
            </div>
            
            <p className="text-xs text-cyan-400/90 font-semibold mb-2">{info.threshold}</p>
            <p className="text-sm text-[#5a6472] mb-3 leading-relaxed">{info.description}</p>
            
            <div className="pt-3 border-t border-[#dde3ec]">
                <p className="text-xs text-[#5a6472] italic flex items-start gap-2">
                    <Target className="w-4 h-4 mt-0.5 shrink-0 text-[#dc4835]" />
                    <span>{info.action}</span>
                </p>
            </div>
            </motion.div>
        </>
    );
}

function PlannerHomeClient() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [summary, setSummary] = useState<PlannerSummary | null>(null);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [activeSemester, setActiveSemester] = useState<{
        id: number;
        name: string;
        type?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        courses: Array<{ code: string; name: string; credits: number; midterm_date?: string | null; final_date?: string | null }>;
        study_schedule?: Array<{ day: string; sessions: Array<{ course: string; hours: number; focus: string }> }> | null;
        ai_exam_tips?: string[] | null;
    } | null>(null);
    const [weeklyPlan, setWeeklyPlan] = useState<Array<{ day: string; sessions: Array<{ course: string; hours: number; focus: string }> }>>([]);
    const [showSetupWizard, setShowSetupWizard] = useState(false);
    const [generatingSchedule, setGeneratingSchedule] = useState(false);
    const [showStatusInfo, setShowStatusInfo] = useState(false);
    const [isLogSessionOpen, setIsLogSessionOpen] = useState(false);
    const [isAddCourseOpen, setIsAddCourseOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const { toast } = useToast();
    // Guards against re-triggering the onboarding wizard immediately after
    // the user completes it — DB propagation can lag behind the refetch.
    const justCompletedOnboardingRef = useRef(false);

    const fetchSummary = useCallback(async () => {
        let attempt = 0;
        const maxAttempts = 4;
        const baseDelay = 100;

        while (attempt < maxAttempts) {
            try {
                const res = await fetch("/api/planner/summary", { cache: "no-store" });
                
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data.details || data.error || `Failed to fetch summary (${res.status})`);
                }

                const data = await res.json();
                setSummary(data as PlannerSummary);

                interface SemesterSummary { 
                    id: number; 
                    name: string; 
                    type?: string | null; 
                    start_date?: string | null; 
                    end_date?: string | null; 
                    courses?: { code: string; name: string; credits: number; midterm_date?: string | null; final_date?: string | null }[]; 
                    study_schedule?: Array<{ day: string; sessions: Array<{ course: string; hours: number; focus: string }> }> | null; 
                    ai_exam_tips?: string[] | null; 
                }
                const semData = (data.allSemesters || []) as SemesterSummary[];
                console.log(`[fetchSummary] Got ${semData.length} semesters. allSemesters=${JSON.stringify(semData.map(s => ({ id: s.id, name: s.name, courses: s.courses?.length ?? 0 })))}`);
                
                // If we got semesters or this is our last attempt, use the result
                if (semData.length > 0 || attempt === maxAttempts - 1) {
                    if (semData.length === 0) {
                        if (!justCompletedOnboardingRef.current) {
                            console.warn(`[fetchSummary] No semesters returned, showing onboarding`);
                            setShowOnboarding(true);
                        } else {
                            console.warn(`[fetchSummary] 0 semesters but onboarding just completed — waiting for DB`);
                        }
                    } else {
                        justCompletedOnboardingRef.current = false;
                        // Set active semester and load cached schedule
                        const sem = semData.find(s => (s.courses?.length ?? 0) > 0) ?? semData[0];
                        if (sem) {
                            setActiveSemester({
                                id: sem.id,
                                name: sem.name,
                                type: sem.type ?? null,
                                start_date: sem.start_date ?? null,
                                end_date: sem.end_date ?? null,
                                courses: sem.courses ?? [],
                                study_schedule: sem.study_schedule,
                                ai_exam_tips: sem.ai_exam_tips,
                            });
                            
                            // Prioritize DB schedule, fallback to safeStorage for legacy
                            if (sem.study_schedule && sem.study_schedule.length > 0) {
                                setWeeklyPlan(sem.study_schedule);
                            } else {
                                const cached = safeStorage.get(`schedule-sem-${sem.id}`);
                                if (cached) {
                                    try {
                                        const parsed = JSON.parse(cached);
                                        if (parsed.weeklyPlan) setWeeklyPlan(parsed.weeklyPlan);
                                    } catch { /* ok */ }
                                }
                            }
                        }
                    }
                    return;
                }

                // If empty but not last attempt, retry with exponential backoff
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[fetchSummary] Empty result on attempt ${attempt + 1}, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;

            } catch (e: unknown) {
                console.error("Fetch error:", e);
                if (attempt === maxAttempts - 1) {
                    const msg = e instanceof Error ? e.message : "Failed to load your dashboard. Please refresh.";
                    toast(msg, "error");
                    return;
                }
                const delay = baseDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
                attempt++;
            }
        }
    }, [toast]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchSummary();
        }
    }, [status, router, fetchSummary]);

    const handleSync = async () => {
        if (!summary?.google_calendar_connected) {
            router.push("/planner/settings");
            return;
        }

        setSyncing(true);
        try {
            const res = await fetch("/api/connect/google/sync", { method: "POST" });
            
            if (res.ok) {
                const data = await res.json();
                const successes = data.syncedItems || 0;
                if (successes > 0) {
                    toast(data.message || `Successfully synced ${successes} items to ${data.googleAccount || 'your calendar'}.`, "success");
                    // Refresh summary to show new upcoming events
                    fetchSummary();
                } else {
                    toast(data.message || "Nothing new to sync. Ensure your course dates are set.", "success");
                }
            } else if (res.status === 401) {
                toast("Google Calendar disconnected. Please reconnect in settings.", "error");
                setSummary({ ...summary, google_calendar_connected: false });
            } else {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Sync failed");
            }
        } catch (e) {
            console.error("Sync error:", e);
            toast("Failed to sync with Google Calendar. Check your connection.", "error");
        } finally {
            setSyncing(false);
        }
    };

    const handleGenerateSchedule = async () => {
        if (!activeSemester || activeSemester.courses.length === 0) {
            toast("Set up a semester and add at least one course first.", "error");
            return;
        }
        
        setGeneratingSchedule(true);
        try {
            const res = await fetch("/api/ai/generate-schedule", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    major: summary?.user?.major || "Computer Science",
                    semesterType: activeSemester.type,
                    semesterName: activeSemester.name,
                    semesterStartDate: activeSemester.start_date,
                    semesterEndDate: activeSemester.end_date,
                    courses: activeSemester.courses,
                    weeklyHours: 14,
                    semesterId: activeSemester.id
                })
            });
            
            let data: { 
                result?: { weeklyPlan?: Array<{ day: string; sessions: Array<{ course: string; hours: number; focus: string }> }>; examTips?: string[] };
                fallback?: { weeklyPlan?: Array<{ day: string; sessions: Array<{ course: string; hours: number; focus: string }> }>; examTips?: string[] };
                details?: string;
                error?: string;
            } = {};
            try {
                data = await res.json();
            } catch (parseErr) {
                console.error("Failed to parse API response:", parseErr);
                throw new Error("Server returned invalid response. Please try again.");
            }
            
            // Handle 503 (service unavailable) with fallback
            if (res.status === 503 && data.fallback) {
                setWeeklyPlan(data.fallback.weeklyPlan || []);
                safeStorage.set(`schedule-sem-${activeSemester.id}`, JSON.stringify(data.fallback));
                toast("Using AI-assisted schedule (service currently busy). Check back soon for full AI optimization!", "info");
                return;
            }
            
            // Handle rate limiting (429)
            if (res.status === 429) {
                throw new Error(data.details || "Daily AI limit reached. You can use AI 2 times per 24 hours.");
            }
            
            // Handle any other error status
            if (!res.ok) {
                const errorMsg = (data.details?.trim?.() || data.error?.trim?.() || `Server error (${res.status})`).trim();
                throw new Error(errorMsg || "Failed to generate schedule");
            }
            
            if (data.result?.weeklyPlan && Array.isArray(data.result.weeklyPlan) && data.result.weeklyPlan.length > 0) {
                setWeeklyPlan(data.result.weeklyPlan);
                safeStorage.set(`schedule-sem-${activeSemester.id}`, JSON.stringify(data.result));
                toast("AI Schedule generated successfully! 🎉", "success");
            } else if (data.result) {
                // AI returned something but it's empty - still valid, just use fallback
                setWeeklyPlan(data.result.weeklyPlan || []);
                safeStorage.set(`schedule-sem-${activeSemester.id}`, JSON.stringify(data.result));
                toast("Schedule created with default settings.", "info");
            } else {
                throw new Error("No schedule data received from server.");
            }
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            console.error("Schedule generation error:", {
                error: errorMsg,
                semesterId: activeSemester?.id,
                courseCount: activeSemester?.courses.length,
            });
            toast(errorMsg || "Failed to generate schedule. Please try again.", "error");
        } finally {
            setGeneratingSchedule(false);
        }
    };

    if (status === "loading" || !summary) {
        return (
            <div className="min-h-screen max-w-7xl mx-auto px-6 pt-14 sm:pt-24 space-y-8">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-[#edf1f6] animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-6 w-24 bg-[#edf1f6] rounded-lg animate-pulse" />
                            <div className="h-4 w-32 bg-[#edf1f6] rounded-lg animate-pulse opacity-50" />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`skeleton-${i}`} className="premium-card h-32 animate-pulse bg-[#edf1f6]" />
                    ))}
                </div>
                <div className="premium-card h-64 animate-pulse bg-[#edf1f6]" />
            </div>
        );
    }

    if (showOnboarding) {
        return <PlannerOnboarding onComplete={async (semesterId?: number) => {
            setShowOnboarding(false);
            justCompletedOnboardingRef.current = true;  // prevent re-trigger on refetch
            if (typeof semesterId === 'number') {
                setActiveSemester({ id: semesterId, name: `Semester ${semesterId}`, type: null, start_date: null, end_date: null, courses: [] });
                // Small delay to ensure DB persistence before refetch
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            fetchSummary();
        }} />;
    }

    return (
        <div className="min-h-screen pb-24 selection:bg-[#dc4835]/30 relative">
            {/* Ambient effects */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute left-1/2 top-0 -translate-x-1/2 w-350 h-200"
                    style={{ background: 'radial-gradient(ellipse 50% 35% at 50% 0%, rgba(220,72,53,0.08) 0%, transparent 70%)' }} />
                <div className="absolute -right-40 top-1/3 w-150 h-150"
                    style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.04) 0%, transparent 70%)' }} />
                <div className="absolute -left-40 bottom-1/4 w-125 h-125"
                    style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)' }} />
                <div className="absolute inset-0 opacity-[0.015]"
                    style={{ backgroundImage: 'linear-gradient(#222d32 1px, transparent 1px), linear-gradient(90deg, #222d32 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
            </div>

            <LogSessionModal
                isOpen={isLogSessionOpen}
                onClose={() => setIsLogSessionOpen(false)}
                courses={(activeSemester?.courses as any) || []}
                onSuccess={() => fetchSummary()}
            />
            <AddCourseModal
                isOpen={isAddCourseOpen}
                onClose={() => setIsAddCourseOpen(false)}
                semesterId={activeSemester?.id || null}
                existingCourses={(activeSemester?.courses as any) || []}
                onSuccess={() => fetchSummary()}
            />
            {/* Header */}
            <header className="hidden sm:flex sticky top-0 z-50 bg-white/80 backdrop-blur-2xl border-b border-[#dde3ec] px-6 py-4 items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#dc4835]/10 border border-[#dde3ec] flex items-center justify-center">
                        <LayoutDashboard className="w-5 h-5 text-[#dc4835]" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight">Semester Planner</h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <BrandMark size="sm" />
                            <p className="text-xs font-bold uppercase tracking-widest text-[#5a6472]">MUBXAI Hub</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="p-2 rounded-xl bg-[#edf1f6] hover:bg-[#dc4835]/10 transition-colors relative"
                        >
                            <Bell className="w-5 h-5 text-[#5a6472]" />
                            {summary?.upcomingEvents && summary.upcomingEvents.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-black" />
                            )}
                        </button>

                        <AnimatePresence>
                            {showNotifications && (
                                <>
                                    <button
                                        type="button"
                                        className="fixed inset-0 z-100 bg-transparent border-none cursor-default"
                                        onClick={() => setShowNotifications(false)}
                                        aria-label="Close notifications"
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute right-0 mt-3 w-72 max-w-[calc(100vw-2rem)] bg-white border border-[#dde3ec] p-4 rounded-3xl z-110 shadow-xl origin-top-right backdrop-blur-xl"
                                    >
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#5a6472] mb-3 flex items-center gap-2">
                                            <Bell className="w-3 h-3" /> Academic Alerts
                                        </h3>
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                            {summary?.upcomingEvents && summary.upcomingEvents.length > 0 ? (
                                                summary.upcomingEvents.map((ev: NotificationEvent, i: number) => (
                                                    <div key={`notification-${i}-${ev.title}`} className="p-3 bg-[#edf1f6] rounded-2xl border border-[#dde3ec] hover:border-[#dc4835]/30 transition-colors">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-[#dc4835]/20 flex items-center justify-center shrink-0">
                                                                <AlertTriangle className="w-4 h-4 text-[#dc4835]" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[11px] font-bold text-[#222d32] leading-tight">{ev.title}</p>
                                                                <p className="text-xs text-[#5a6472] mt-1">
                                                                    {ev.type?.toLowerCase().includes("exam")
                                                                        ? new Date(ev.start_datetime).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'Asia/Amman' })
                                                                        : new Date(ev.start_datetime).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' })}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="py-8 text-center">
                                                    <p className="text-xs text-[#5a6472] italic">No urgent notifications</p>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>

                    <a
                        href="https://bot.mubx.dev"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-cyan-100 border border-cyan-300 text-cyan-800 hover:bg-cyan-200 transition-all"
                        title="Open mubxbot"
                    >
                        <Bot className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">mubxbot</span>
                    </a>

                    <div className="relative">
                        <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} aria-haspopup="true" aria-expanded={profileMenuOpen}
                            className="w-10 h-10 rounded-2xl bg-linear-to-br from-[#dc4835] to-blue-600 flex items-center justify-center text-white font-black text-sm shadow-[0_0_20px_rgba(220,72,53,0.2)]">
                            {(() => {
                                const name = session?.user?.name || session?.user?.email || '';
                                const parts = name.trim().split(/\s+/).filter(Boolean);
                                if (parts.length === 0) return 'HT';
                                if (parts.length === 1) return parts[0].substring(0,2).toUpperCase();
                                return (parts[0][0] + (parts.at(-1)?.[0] ?? '')).toUpperCase();
                            })()}
                        </button>

                        {profileMenuOpen && (
                            <div className="absolute right-0 mt-2 w-44 bg-white border border-[#dde3ec] rounded-xl p-2 shadow-xl z-50">
                                <Link href="/" className="block w-full text-left px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>Course Tracker</Link>
                                <Link href="/planner" className="block px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>Semester Planner</Link>
                                <Link href="/planner/settings" className="block px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>Profile & Settings</Link>
                                <div className="h-px bg-[#dde3ec] my-1" />
                                <button onClick={() => void signOut({ callbackUrl: '/' })} className="w-full text-left px-3 py-2 text-sm text-[#dc4835] hover:bg-red-50 rounded transition-colors">Sign out</button>
                            </div>
                        )}
                    </div>

                    <div className="hidden sm:block">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="max-w-md md:max-w-3xl lg:max-w-5xl xl:max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-36 space-y-6">

                {/* Gamification & User Stats Bar */}
                {summary?.gamification && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#dc4835]/5 border border-[#dc4835]/20 rounded-4xl p-6 backdrop-blur-sm"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-linear-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-[0_0_30px_rgba(251,191,36,0.2)]">
                                <Trophy className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black font-display tracking-tight border-b-2 border-[#dde3ec] pb-1">Lvl {summary.gamification.level}</h2>
                                <p className="text-sm font-medium text-[#5a6472] mt-1">{summary.gamification.xp} XP Earned</p>
                            </div>
                        </div>

                        <div className="flex gap-4 w-full sm:w-auto mt-2 sm:mt-0">
                            <div className="flex-1 sm:flex-none glass-panel rounded-2xl p-4 flex flex-col items-center justify-center min-w-24">
                                <span className="text-xl font-black text-orange-400">{summary.gamification.current_streak_days}🔥</span>
                                <span className="text-xs text-[#5a6472] uppercase tracking-widest mt-1">Streak</span>
                            </div>
                            <div className="flex-1 sm:flex-none glass-panel rounded-2xl p-4 flex flex-col items-center justify-center min-w-24 relative">
                                <span className="text-xl font-black text-blue-400">{summary.classification === 'N/A' ? '-' : summary.classification}</span>
                                <span className="text-xs text-[#5a6472] uppercase tracking-widest mt-1">Status</span>
                                {summary.classification && summary.classification !== 'N/A' && (
                                    <button
                                        onClick={() => setShowStatusInfo(!showStatusInfo)}
                                        className="absolute top-2 right-2 p-1 hover:bg-[#edf1f6] rounded-full transition-colors"
                                        title="View status explanation"
                                    >
                                        <HelpCircle className="w-4 h-4 text-cyan-400/60 hover:text-cyan-400" />
                                    </button>
                                )}
                                <AnimatePresence>
                                    {showStatusInfo && summary.classification && summary.classification !== 'N/A' && (
                                        <StatusExplanationPopover
                                            classification={summary.classification}
                                            onClose={() => setShowStatusInfo(false)}
                                        />
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* GPA Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="premium-card p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Target className="w-5 h-5 text-emerald-400" /> CGPA Overview
                            </h2>
                        </div>
                        <div className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-white to-white/60">
                            {summary?.cgpa && summary.cgpa > 0 ? summary.cgpa.toFixed(2) : '-.--'}
                        </div>
                        <p className="text-sm text-[#5a6472] mt-2 max-w-50">
                            Calculated dynamically combining your imported academic history and HTU Planner tracked modules.
                        </p>
                    </motion.div>

                    {/* Active Semester Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 }}
                        className="premium-card p-6 flex flex-col justify-between relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-6 pointer-events-none">
                            <Sparkles className="w-32 h-32 text-[#5a6472]/30" />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <BookOpen className="w-5 h-5 text-blue-400" /> Active Semester
                                </h2>
                            </div>
                            {summary?.currentSemester ? (
                                <>
                                    <h3 className="text-2xl font-black">{summary.currentSemester.name}</h3>
                                    <p className="text-[#5a6472] text-sm mt-1">{summary.currentSemester.courses?.length || 0} Courses Tracked</p>
                                </>
                            ) : (
                                <div className="mt-2">
                                    <p className="text-[#5a6472] text-sm mb-4">No active tracking semester found. Start logging your progress today.</p>
                                </div>
                            )}
                        </div>

                        {summary?.currentSemester ? (
                            <div className="mt-6 flex flex-col gap-2 relative z-10">
                                <button
                                    onClick={() => setIsAddCourseOpen(true)}
                                    className="flex items-center justify-between px-5 py-3 rounded-xl bg-[#dc4835] hover:bg-[#c03d2e] transition-colors group w-full text-white shadow-[0_0_20px_rgba(220,72,53,0.3)]"
                                >
                                    <span className="font-semibold text-sm">Quick Add Course</span>
                                    <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                </button>
                                <button
                                    onClick={() => setIsLogSessionOpen(true)}
                                    className="flex items-center justify-between px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors group w-full text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]"
                                >
                                    <span className="font-semibold text-sm">Log Study Time</span>
                                    <Clock className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                </button>
                                <Link
                                    href="/planner/semesters"
                                    className="flex items-center justify-between px-5 py-3 rounded-xl bg-[#edf1f6] hover:bg-[#dde3ec] transition-colors group w-full text-[#222d32] mt-2"
                                >
                                    <span className="font-semibold text-sm">Manage Semesters</span>
                                    <ArrowRight className="w-4 h-4 text-[#5a6472] group-hover:text-[#222d32] group-hover:translate-x-1 transition-all" />
                                </Link>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowSetupWizard(true)}
                                className="mt-4 flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-[#dc4835] hover:bg-[#c03d2e] shadow-[0_0_20px_rgba(220,72,53,0.4)] transition-all group w-full relative z-10"
                            >
                                <span className="font-black text-sm text-white">Set up your semester</span>
                                <Plus className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                            </button>
                        )}
                    </motion.div>
                </div>

                {/* Study Schedule Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="premium-card p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-black flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-emerald-400" /> Weekly Study Plan
                            </h2>
                            <p className="text-xs text-[#5a6472] mt-1">AI-generated schedule based on your current workload</p>
                        </div>
                        {weeklyPlan.length > 0 && activeSemester && activeSemester.courses.length > 0 && (
                            <button
                                onClick={handleGenerateSchedule}
                                disabled={generatingSchedule}
                                className="text-xs font-bold text-[#dc4835] hover:text-[#c03d2e] transition-colors flex items-center gap-1 group disabled:opacity-50"
                            >
                                {generatingSchedule ? "Syncing..." : "Rebuild"}
                                <RefreshCcw className={`w-3 h-3 ${generatingSchedule ? 'animate-spin' : 'group-hover:rotate-180'} transition-transform duration-500`} />
                            </button>
                        )}
                    </div>

                    {weeklyPlan.length > 0 || generatingSchedule ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {generatingSchedule ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={`skeleton-trend-${i}`} className="bg-[#edf1f6] border border-[#dde3ec] rounded-2xl p-4 animate-pulse space-y-3">
                                        <div className="h-2 w-12 bg-[#edf1f6] rounded" />
                                        <div className="space-y-2">
                                            <div className="h-3 w-full bg-[#edf1f6] rounded" />
                                            <div className="h-2 w-2/3 bg-[#edf1f6] rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                weeklyPlan.slice(0, 4).map((dayPlan, _i) => (
                                    <div key={dayPlan.day} className="bg-[#edf1f6] border border-[#dde3ec] rounded-2xl p-4 hover:bg-[#edf1f6] transition-colors">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-xs font-black uppercase tracking-widest text-emerald-400">{dayPlan.day}</span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        </div>
                                        <div className="space-y-3">
                                            {dayPlan.sessions.map((session, j) => (
                                                <div key={`session-${dayPlan.day}-${j}`} className="space-y-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold truncate text-[#222d32]">{session.course}</span>
                                                        <span className="text-xs font-bold text-emerald-400/80 shrink-0">{session.hours}h</span>
                                                    </div>
                                                    <p className="text-xs text-[#5a6472] line-clamp-1 italic">&quot;{session.focus}&quot;</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center bg-[#edf1f6] border border-dashed border-[#dde3ec] rounded-3xl">
                            <div className="w-16 h-16 rounded-2xl bg-[#edf1f6] flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-[#dc4835] opacity-20" />
                            </div>
                            <h3 className="text-base font-bold text-[#5a6472]">No Study Plan Yet</h3>
                            <p className="text-xs text-[#5a6472] max-w-60 mt-2 mb-6">
                                Generate a personalized study schedule using AI to optimize your learning.
                            </p>
                            {activeSemester && activeSemester.courses.length > 0 ? (
                                <button
                                    onClick={handleGenerateSchedule}
                                    disabled={generatingSchedule}
                                    className="px-6 py-2.5 rounded-xl bg-[#dc4835] hover:bg-[#c03d2e] disabled:opacity-50 text-xs font-bold text-white transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(220,72,53,0.3)]"
                                >
                                    {generatingSchedule ? (
                                        <div className="w-3 h-3 rounded-full bg-white animate-ping mr-1" />
                                    ) : (
                                        <Sparkles className="w-4 h-4" />
                                    )}
                                    {generatingSchedule ? "Thinking..." : "Build your schedule"}
                                    {!generatingSchedule && <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setShowSetupWizard(true)}
                                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition-all flex items-center gap-2 group shadow-[0_0_20px_rgba(245,158,11,0.3)]"
                                >
                                    <Calendar className="w-4 h-4" />
                                    Set up your semester
                                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </button>
                            )}
                        </div>
                    )}
                </motion.div>

                {/* Quests & Challenges */}
                {summary?.gamification && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25 }}
                        className="premium-card p-6 border-[#dc4835]/20 bg-[#dc4835]/5"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-[#dc4835]" /> Active Quests
                            </h2>
                            <Link href="/planner/gamification" className="px-2 py-1 bg-[#dc4835]/20 text-[#dc4835] text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-[#dc4835]/30 transition-colors">
                                View All
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {summary.activeQuests && summary.activeQuests.length > 0 ? (
                                summary.activeQuests.map((quest: QuestItem) => {
                                    const progressPercent = Math.min((quest.current_value / quest.target_value) * 100, 100);
                                    const isStudy = quest.type === 'study_minutes' || quest.type === 'study_sessions';
                                    
                                    return (
                                        <div key={quest.id} className="bg-[#edf1f6] border border-[#dde3ec] p-4 rounded-2xl flex items-start gap-4 hover:bg-[#edf1f6] transition-colors group">
                                            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border ${isStudy ? 'bg-blue-500/20 border-blue-500/30' : 'bg-orange-500/20 border-orange-500/30 relative overflow-hidden'}`}>
                                                {isStudy ? (
                                                    <BookOpen className="w-5 h-5 text-blue-400" />
                                                ) : (
                                                    <>
                                                        <div className="absolute inset-0 bg-linear-to-t from-orange-500/20 to-transparent" />
                                                        <span className="text-xl leading-none relative z-10">🔥</span>
                                                    </>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-sm text-[#222d32] transition-colors truncate capitalize">{quest.type.replace('_', ' ')}</h3>
                                                <p className="text-[11px] text-[#5a6472] mt-1 line-clamp-1">{quest.target_value} {quest.type.includes('minutes') ? 'min' : 'sessions'} target</p>
                                                <div className="mt-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest">
                                                    <div className="h-1.5 flex-1 bg-[#edf1f6] rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${isStudy ? 'bg-blue-500' : 'bg-orange-500'}`}
                                                            style={{ width: `${progressPercent}%` }}
                                                        />
                                                    </div>
                                                    {(() => {
                                                        let textColor = "text-orange-400";
                                                        if (progressPercent >= 100) textColor = "text-emerald-400";
                                                        else if (isStudy) textColor = "text-blue-400";
                                                        
                                                        return (
                                                            <span className={textColor}>
                                                                {quest.current_value}/{quest.target_value}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="col-span-full py-4 text-center border border-dashed border-[#dde3ec] rounded-2xl">
                                    <p className="text-xs text-[#5a6472] font-medium">All quests completed! Check back later.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Neglected Course Alert */}
                {summary?.neglectedCourse && (
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-panel p-6 rounded-4xl border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-center gap-6"
                    >
                        <div className="w-16 h-16 rounded-3xl bg-amber-500/20 flex items-center justify-center shrink-0 animate-pulse">
                            <AlertTriangle className="w-8 h-8 text-amber-500" />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h3 className="text-lg font-bold text-amber-500 flex items-center justify-center sm:justify-start gap-2">
                                Examination Alert: {summary.neglectedCourse.name}
                            </h3>
                            <p className="text-sm text-[#5a6472] mt-1">
                                You have an upcoming exam in less than 14 days, but only <span className="text-amber-400 font-bold">{summary.neglectedCourse.total_study_minutes} minutes</span> logged so far. Focus more time here!
                            </p>
                        </div>
                        <button
                            onClick={() => setIsLogSessionOpen(true)}
                            className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-sm transition-all whitespace-nowrap"
                        >
                            Log Study Session
                        </button>
                    </motion.div>
                )}

                {/* Smart Insights & Pro Study Tips */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* GPA Projection Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35 }}
                        className="premium-card p-6 flex flex-col justify-between border-emerald-500/20 bg-emerald-900/10"
                    >
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
                                    <TrendingUp className="w-4 h-4" /> GPA Projection
                                </h2>
                            </div>
                            <p className="text-xs text-[#5a6472] mb-4">Estimate your future standing if you maintain current performance.</p>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-[#5a6472]">
                                    <span>Target Grade</span>
                                    <span>Projected CGPA</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-[#222d32]">Distinction (D)</span>
                                    <span className="text-sm font-black text-emerald-400">
                                        {summary?.projections?.distinction || '---'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-[#222d32]">Merit (M)</span>
                                    <span className="text-sm font-black text-blue-400">
                                        {summary?.projections?.merit || '---'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[11px] text-[#5a6472] mt-4 italic">* Based on {summary?.projections?.remainingCH || 0} remaining CH.</p>
                    </motion.div>

                    {/* Pro Study Tips Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="md:col-span-2 premium-card p-6 border-indigo-500/20 bg-indigo-900/10"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-bold flex items-center gap-2 text-indigo-400">
                                <Flame className="w-4 h-4" /> Smart Study Tips
                            </h2>
                            <span className="text-[11px] font-black bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full uppercase tracking-tighter">Personalized</span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {summary?.studyTips?.map((tip: StudyTip) => {
                                const tipBgColors: Record<StudyTip['color'], string> = {
                                    orange: 'bg-orange-500/20',
                                    emerald: 'bg-emerald-500/20',
                                    indigo: 'bg-indigo-500/20'
                                };
                                const tipBgColor = tipBgColors[tip.color] ?? tipBgColors.indigo;
                                
                                return (
                                    <div key={tip.title} className="p-4 rounded-2xl bg-[#edf1f6] border border-[#dde3ec] flex gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${tipBgColor}`}>
                                            {tip.icon === 'clock' && <Clock className="w-4 h-4 text-orange-400" />}
                                            {tip.icon === 'target' && <Target className="w-4 h-4 text-emerald-400" />}
                                            {tip.icon === 'flame' && <Flame className="w-4 h-4 text-indigo-400" />}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-[#222d32]">{tip.title}</h4>
                                            <p className="text-xs text-[#5a6472] mt-1 leading-relaxed">{tip.text}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Study Habit Trends */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="premium-card p-6"
                    >
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-[#dc4835]" /> Weekly Study Habits
                            </h2>
                            <span className="text-xs text-[#5a6472] font-bold uppercase tracking-widest">Last 7 Days (Mins)</span>
                        </div>

                        <div className="flex items-end justify-between h-48 gap-2 px-2">
                            {summary?.studyTrends && summary.studyTrends.length > 0 && summary.studyTrends.map((day: StudyTrendPoint, i: number) => {
                                const maxMins = summary.studyTrends ? Math.max(...summary.studyTrends.map((d: StudyTrendPoint) => d.minutes), 60) : 60;
                                const height = (day.minutes / maxMins) * 100;
                                return (
                                    <div key={`trend-${day.date}-${i}`} className="flex-1 flex flex-col items-center gap-2 group">
                                        <div className="relative w-full flex justify-center items-end h-full">
                                            <div
                                                className={`w-full max-w-10 rounded-t-lg transition-all duration-700 ${day.minutes > 0 ? 'bg-linear-to-t from-[#dc4835] to-blue-500 shadow-[0_0_20px_rgba(220,72,53,0.3)]' : 'border-2 border-dashed border-[#dde3ec] bg-transparent'}`}
                                                style={{ height: `${Math.max(height, 10)}%` }}
                                            />
                                            {day.minutes > 0 && (
                                                <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-[#222d32] border border-[#222d32] px-2 py-1 rounded text-xs font-bold text-white z-10">
                                                    {day.minutes}m
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-bold text-[#5a6472] uppercase">
                                            {new Date(day.date).toLocaleDateString([], { weekday: 'short', timeZone: 'Asia/Amman' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>

                    {/* Upcoming Calendar Events */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="premium-card p-6"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-400" /> {summary?.upcomingEventsLabel || "Upcoming 7 Days"}
                            </h2>
                            <button
                                onClick={handleSync}
                                disabled={syncing}
                                className={`text-xs font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all
                                    ${summary?.google_calendar_connected
                                        ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                        : 'bg-[#edf1f6] text-[#5a6472] hover:bg-[#edf1f6] hover:text-[#5a6472]'}`}
                            >
                                {(() => {
                                    if (syncing) return <><RefreshCcw className="w-4 h-4 animate-spin" /> Syncing...</>;
                                    if (summary?.google_calendar_connected) return <><RefreshCcw className="w-4 h-4" /> Sync Calendar</>;
                                    return <><ExternalLink className="w-4 h-4" /> Connect Calendar</>;
                                })()}
                            </button>
                        </div>

                        <div className="space-y-3 h-60 overflow-y-auto pr-2 custom-scrollbar">
                            {summary?.upcomingEvents && summary.upcomingEvents.length > 0 ? (
                                summary.upcomingEvents.map((event: NotificationEvent) => (
                                    <div key={event.id} className="p-4 rounded-2xl bg-[#edf1f6] hover:bg-[#edf1f6] transition-colors border border-transparent hover:border-[#dde3ec]">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-[#dde3ec] flex flex-col items-center justify-center shrink-0">
                                                    <span className="text-[11px] uppercase text-[#5a6472] font-bold">{new Date(event.start_datetime).toLocaleDateString('en-US', { month: 'short' })}</span>
                                                    <span className="text-base font-black leading-none">{new Date(event.start_datetime).getDate()}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm truncate">{event.title}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#edf1f6] text-[#5a6472] tracking-wider">
                                                            {event.type.replace('_', ' ').toUpperCase()}
                                                        </span>
                                                        <span className="text-xs text-[#5a6472] tabular-nums">
                                                            {new Date(event.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Amman' })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <ChevronRight className="w-4 h-4 text-[#5a6472] shrink-0" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-[#dde3ec] rounded-2xl bg-[#edf1f6]">
                                    <Calendar className="w-8 h-8 text-[#5a6472] mb-3" />
                                    <p className="text-[#5a6472] text-xs font-medium">No upcoming deadlines found.</p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>

            </main>

            <AnimatePresence>
                {showSetupWizard && (
                    <SemesterSetupWizard
                        onClose={() => setShowSetupWizard(false)}
                        onComplete={(semesterId) => {
                            console.log(`[SetupWizard.onComplete] Semester created with id=${semesterId}`);
                            setShowSetupWizard(false);
                            if (typeof semesterId === 'number') {
                                console.log(`[SetupWizard.onComplete] Setting activeSemester and clearing onboarding`);
                                setShowOnboarding(false);
                                setActiveSemester(prev => prev?.id === semesterId ? prev : { id: semesterId, name: `Semester ${semesterId}`, type: null, start_date: null, end_date: null, courses: [] });
                            }
                            console.log(`[SetupWizard.onComplete] Calling fetchSummary...`);
                            fetchSummary();
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

const PlannerHomeClientMemoized = memo(PlannerHomeClient);
export default PlannerHomeClientMemoized;
