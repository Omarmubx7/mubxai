"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MAJORS, MajorKey } from "@/lib/useMajor";
import LandingPage from "@/components/LandingPage";
import SiteFooter from "@/components/SiteFooter";
import { Course, CourseData, CurriculumRules } from "@/types";
import { Settings2, Bot, BookOpen, ShieldCheck } from "lucide-react";
import { useSession, signOut } from "@/lib/session-stub";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import Image from "next/image";
import dynamic from "next/dynamic";
import { safeStorage } from "@/lib/safe-storage";
import { fetchWithRetry, fetchJSON } from "@/lib/fetch-retry";
import { useIsAdmin } from "@/lib/use-is-admin";
import { isTrackerVisibleCourse } from "@/lib/constants";

import type { CourseTrackerViewProps } from "@/components/CourseTrackerView";
const StudentLogin = dynamic(() => import("@/components/StudentLogin"), { ssr: false });
const MajorSelector = dynamic(() => import("@/components/MajorSelector"), { ssr: false });
const CourseTrackerView = dynamic<CourseTrackerViewProps>(() => import("@/components/CourseTrackerView") as any);

type AppState = "checking" | "landing" | "login" | "major-select" | "course-tracker" | "changing-major";

export default function HomeClient() {
    const { data: session, status } = useSession();
    const isAdmin = useIsAdmin();
    // Start on the public landing page so its content is server-rendered.
    // The session effect below promotes authenticated users to the tracker.
    const [appState, setAppState] = useState<AppState>("landing");
    const [studentId, setStudentId] = useState<string | null>(null);
    const [major, setMajor] = useState<MajorKey | null>(null);
    const [courseData, setCourseData] = useState<CourseData | null>(null);
    const [rules, setRules] = useState<CurriculumRules | null>(null);
    
    // Progress State (Lifted for Insights)
    const [completedCourses, setCompletedCourses] = useState<Map<string, string>>(new Map());
    const [previousGpaHistory, setPreviousGpaHistory] = useState<{ gpa: number | null, credits: number | null }>({ gpa: null, credits: null });
    const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | null>(null);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [courseNameMap, setCourseNameMap] = useState<Map<string, string>>(new Map());
    const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ─── 1. Core Logic & Data Fetching (Defined first to avoid ReferenceErrors) ────────────────

    const saveProgressRemote = useCallback(async (currentProgress: Map<string, string>) => {
        const sid = studentId || session?.user?.student_id || session?.user?.email;
        const maj = major || (session?.user as { major?: string })?.major;
        if (!sid || !maj) return;
        try {
            const completedObjects = Array.from(currentProgress.entries()).map(([c, g]) => ({
                code: c,
                name: courseNameMap.get(c) || "",
                grade: g
            }));
            await fetchWithRetry(`/api/progress/${encodeURIComponent(sid)}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ major: maj, completed: completedObjects }),
                retries: 2
            });
            setSaveStatus("saved");
        } catch (error) {
            console.error("Failed to save progress", error);
            setSaveStatus(null);
        }
    }, [studentId, session, major, courseNameMap]);

    const debouncedSave = useCallback((nextState: Map<string, string>) => {
        setSaveStatus("saving");
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            void saveProgressRemote(nextState);
        }, 500);
    }, [saveProgressRemote]);

    const loadCourses = useCallback(async (key: MajorKey): Promise<boolean> => {
        try {
            const rulesPath = "/data/curriculum_rules.json";
            const curriculumPath = "/data/curriculum.json";
            const [rulesRes, currRes] = await Promise.all([
                fetchWithRetry(rulesPath, { retries: 2 }), 
                fetchWithRetry(curriculumPath, { retries: 2 })
            ]);

            if (!rulesRes.ok || !currRes.ok) {
                throw new Error("Failed to load curriculum resources");
            }

            const rulesData = await rulesRes.json();
            const currData = await currRes.json();
            setRules(rulesData);

            if (!currData.majors?.[key]) {
                return false;
            }

            const majorData = currData.majors[key];
            const shared = currData.shared;
            const seenGlobal = new Set<string>();

            const isCourseApplicableToMajor = (course: Course): boolean => {
                if (!course.major_keys || course.major_keys.length === 0) return true;
                return course.major_keys.includes(key);
            };
            
            const mergeAndDeduplicateGlobal = (sharedArr: Course[] = [], majorArr: Course[] = []): Course[] => {
                const scopedShared = sharedArr.filter(isCourseApplicableToMajor);
                const combined = [...scopedShared, ...majorArr];
                return combined.filter((item) => {
                    if (!isTrackerVisibleCourse(item)) return false;
                    if (!item.code) return true;
                    if (seenGlobal.has(item.code)) return false;
                    seenGlobal.add(item.code);
                    return true;
                });
            };

            setCourseData({
                university_requirements: mergeAndDeduplicateGlobal(shared.university_requirements, majorData.university_requirements),
                college_requirements: mergeAndDeduplicateGlobal(shared.college_requirements, majorData.college_requirements),
                university_electives: mergeAndDeduplicateGlobal(shared.university_electives, majorData.university_electives),
                department_requirements: mergeAndDeduplicateGlobal(shared.department_requirements, majorData.department_requirements),
                electives: mergeAndDeduplicateGlobal(shared.electives, majorData.electives),
                work_market_requirements: mergeAndDeduplicateGlobal(shared.work_market_requirements, majorData.work_market_requirements),
            });

            return true;
        } catch (error) {
            console.error("Failed to load courses", error);
            setRules(null);
            setCourseData(null);
            return false;
        }
    }, []);

    const loadProgress = useCallback(async (id: string, majorKey: string) => {
        try {
            const data = await fetchJSON<{ completed: Array<string | { code: string; grade?: string | number }> }>(
                `/api/progress/${encodeURIComponent(id)}?major=${majorKey}`,
                { retries: 2 }
            );
            const gradeMap = new Map<string, string>();
            data.completed.forEach((c) => {
                const code = typeof c === 'string' ? c : c.code;
                let grade = typeof c === 'object' && c.grade !== undefined ? String(c.grade) : "M";
                if (!Number.isNaN(Number(grade)) && grade !== "WF") {
                    const n = Number(grade);
                    if (n >= 90) grade = "D"; else if (n >= 80) grade = "M"; else if (n >= 70) grade = "P"; else grade = "U";
                }
                gradeMap.set(code, grade);
            });
            setCompletedCourses(gradeMap);
        } catch (error) {
            console.error("Failed to load progress", error);
            setCompletedCourses(new Map());
        }
    }, []);

    const loadProfile = useCallback(async (id: string) => {
        setStudentId(id);
        try {
            const res = await fetchWithRetry(`/api/profile/${encodeURIComponent(id)}`, { retries: 2 });
            if (res.ok) {
                const profile = await res.json();
                const savedMajor = profile.major || profile.savedMajor; // Support both naming variants
                
                console.log("[HomeClient] Profile loaded successfully:", { 
                    sid: id, 
                    major: savedMajor,
                });

                setPreviousGpaHistory({
                    gpa: profile.previous_gpa || profile.historyGpa || null,
                    credits: profile.previous_credits || profile.historyCredits || null
                });

                if (savedMajor) {
                    setMajor(savedMajor);
                    // Also sync to safeStorage for immediate subsequent checks
                    safeStorage.set(`major-${id}`, savedMajor);
                    
                    const loaded = await loadCourses(savedMajor);
                    await loadProgress(id, savedMajor); // Pass savedMajor here
                    setAppState(loaded ? "course-tracker" : "major-select");
                } else { 
                    setAppState("major-select"); 
                }
            } else { 
                setAppState("major-select"); 
            }
        } catch (error) {
            console.error("[HomeClient] Failed to load profile", error);
            setAppState("major-select");
        }
    }, [loadCourses, loadProgress]);

    // ─── 2. Mutation Handlers (Referencing core logic) ───────────────────────

    const toggleCourse = useCallback(async (code: string) => {
        // Resolve studentId from state OR session (guards against race during hydration)
        const sid = studentId || session?.user?.student_id || session?.user?.email;
        const maj = major || (session?.user as { major?: string })?.major;
        if (!sid || !maj) {
            console.warn("[HomeClient] toggleCourse: no studentId or major yet", { sid, maj });
            return;
        }
        
        const next = new Map(completedCourses);
        if (next.has(code)) next.delete(code);
        else next.set(code, "M");
        
        setCompletedCourses(next);
        debouncedSave(next);
    }, [studentId, session, major, completedCourses, debouncedSave]);

    const updateCourseGrade = useCallback((code: string, grade: string) => {
        const sid = studentId || session?.user?.student_id || session?.user?.email;
        const maj = major || (session?.user as { major?: string })?.major;
        if (!sid || !maj) return;
        
        const next = new Map(completedCourses);
        next.set(code, grade);
        
        setCompletedCourses(next);
        debouncedSave(next);
    }, [studentId, session, major, completedCourses, debouncedSave]);

    const handleMajorSelect = async (key: MajorKey) => {
        setAppState("changing-major");
        setMajor(key);
        const sid = studentId || session?.user?.student_id || session?.user?.email;
        if (sid) {
            safeStorage.set(`major-${sid}`, key);
            try {
                setAppState("changing-major");
                console.log("[HomeClient] Saving major:", key, "for", sid);
                const res = await fetchWithRetry(`/api/profile/${encodeURIComponent(sid)}/save`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ major: key }),
                    retries: 2
                });

                if (!res.ok) {
                    console.error("[HomeClient] Failed to save major:", res.status);
                }

                const loaded = await loadCourses(key);
                console.log("[HomeClient] Curriculum load result after save:", loaded);
                setAppState(loaded ? "course-tracker" : "major-select");
            } catch (error) {
                console.error("[HomeClient] handleMajorSelect error:", error);
                setAppState("major-select");
            }
        } else {
            const loaded = await loadCourses(key);
            setAppState(loaded ? "course-tracker" : "major-select");
        }
    };

    // ─── 3. Life Cycle Effects ──────────────────────────────────────────────

    // Failsafe: if auth resolution is still pending after a few seconds, fall back to landing.
    // This avoids flashing the login screen during the first post-signup session bootstrap.
    useEffect(() => {
        if (appState !== "checking" || status !== "loading") return;

        const timer = setTimeout(() => {
            console.warn("[HomeClient] Failsafe triggered: Forced to landing state");
            setAppState("landing");
        }, 5000);

        return () => clearTimeout(timer);
    }, [appState, status]);

    // Ensure we scroll to top after switching to the login view (scroll after render)
    useEffect(() => {
        if (appState === 'login') {
            const t = setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }, 60);
            return () => clearTimeout(t);
        }
    }, [appState]);

    // Load initial major
    useEffect(() => {
        const primaryMajor = safeStorage.get("mubxai-major");
        const legacyMajor = safeStorage.get("htu_selected_major");
        const storedMajor = primaryMajor || legacyMajor;
        if (storedMajor) {
            setMajor(storedMajor as MajorKey);
            safeStorage.set("htu_selected_major", storedMajor);
            safeStorage.set("mubxai-major", storedMajor);
        }
    }, []);

    // Build course name map
    useEffect(() => {
        if (!courseData) return;
        const newMap = new Map<string, string>();
        const processCategory = (category?: Course[]) => {
            if (!Array.isArray(category)) return;
            for (const item of category) {
                if (item.code && item.name) newMap.set(item.code, item.name);
            }
        };
        [
            courseData.university_requirements,
            courseData.college_requirements,
            courseData.university_electives,
            courseData.department_requirements,
            courseData.electives,
            courseData.work_market_requirements,
        ].forEach(processCategory);
        setCourseNameMap(newMap);
    }, [courseData]);

    useEffect(() => {
        if (status === "loading") return;
        if (status === "unauthenticated") {
            if (appState === "checking") {
                setAppState("landing");
            }
            return;
        }

        if (status === "authenticated" && session?.user && appState !== "changing-major") {
            const sid = session.user.student_id || session.user.email;
            if (sid) {
                // Always ensure studentId state is set from session immediately
                setStudentId(prev => prev ?? sid);

                const storageMajor = safeStorage.get(`major-${sid}`) as MajorKey | null;
                
                // If we have it in storage and haven't loaded data yet, load it
                if (storageMajor && !courseData && (appState === "checking" || appState === "landing")) {
                    setMajor(storageMajor);
                    (async () => {
                        const loaded = await loadCourses(storageMajor);
                        await loadProgress(sid, storageMajor);
                        setAppState(loaded ? "course-tracker" : "major-select");
                    })();
                }
                // If not in storage, try database recovery
                else if (!storageMajor && (appState === "checking" || appState === "landing" || appState === "login")) {
                    void loadProfile(sid);
                }
            }
        }
    }, [status, session, loadProfile, loadCourses, loadProgress, courseData, appState]);

    useEffect(() => {
        return () => {
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, []);

    const majorInfo = major ? MAJORS.find(m => m.key === major) : null;

    return (
        <>
            {(appState === "checking" || appState === "changing-major") && (
                <Spinner message={appState === "changing-major" ? "Updating Curriculum" : "Initializing Workspace"} />
            )}

            {appState === "landing" && (
                <>
                    <LandingPage onGetStarted={() => setAppState("login")} />
                    <SiteFooter />
                </>
            )}

            {appState === "login" && (
                <StudentLogin />
            )}

            {appState === "major-select" && (
                <MajorSelector 
                    onSelect={handleMajorSelect} 
                    onCancel={major ? () => setAppState("course-tracker") : undefined} 
                />
            )}

            {appState === "course-tracker" && courseData && rules && (
                <div className="min-h-screen flex flex-col pt-14 sm:pt-20">
                    <header className="hidden sm:flex fixed top-0 left-0 right-0 z-60 h-20 bg-white border-b border-[#dde3ec]" style={{ boxShadow: '0 1px 4px rgba(34,45,50,0.08)' }}>
                        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
                            <div id="wt-header-brand" className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#edf1f6] flex items-center justify-center overflow-hidden border border-[#dde3ec]">
                                    <Image src="/mubxai-light-logo.png" alt="MUBXAI" width={20} height={20} />
                                </div>
                                <span className="text-xs sm:text-sm font-black tracking-tight text-[#222d32] uppercase">MUBXAI</span>
                            </div>

                            <div id="wt-profile" className="flex items-center gap-3">
                                    <div className="flex flex-col items-end">
                                        <span className="text-xs font-bold text-[#5a6472] uppercase tracking-widest">{studentId}</span>
                                        {majorInfo && (
                                            <button onClick={() => setAppState("major-select")} className="group flex items-center gap-2 px-2 py-1 rounded-md bg-[#edf1f6] border border-[#dde3ec] hover:border-[#dc4835] transition-colors">
                                                <Settings2 className="w-3 h-3 text-[#5a6472]" />
                                                <span className="text-xs font-bold text-[#222d32]">{majorInfo.label}</span>
                                                <span>{majorInfo.icon}</span>
                                            </button>
                                        )}
                                    </div>
                                    <a
                                        href="https://bot.mubx.dev"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#dc4835] hover:bg-[#fe1f11] text-white transition-colors"
                                        title="Open mubxbot"
                                    >
                                        <Bot className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">mubxbot</span>
                                    </a>
                                    <Link
                                        href="/resources"
                                        className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#0da55a] hover:bg-[#0b8f4d] text-white transition-colors"
                                        title="Course Resources"
                                    >
                                        <BookOpen className="w-4 h-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">Resources</span>
                                    </Link>
                                    <div className="relative">
                                        <button onClick={() => setProfileMenuOpen(!profileMenuOpen)} aria-haspopup="true" aria-expanded={profileMenuOpen}
                                            className="w-10 h-10 rounded-md bg-[#dc4835] hover:bg-[#fe1f11] flex items-center justify-center text-white font-black text-sm transition-colors">
                                            {(() => {
                                                const name = session?.user?.name || studentId || '';
                                                const parts = name.trim().split(/\s+/).filter(Boolean);
                                                if (parts.length === 0) return 'HT';
                                                if (parts.length === 1) return parts[0].substring(0,2).toUpperCase();
                                                return (parts[0][0] + (parts.at(-1)?.[0] ?? '')).toUpperCase();
                                            })()}
                                        </button>

                                        {profileMenuOpen && (
                                            <div className="absolute right-0 mt-2 w-48 bg-white border border-[#dde3ec] rounded-lg p-2 shadow-[0_4px_14px_rgba(34,45,50,0.12)] z-50">
                                                <button type="button" onClick={() => { setAppState("course-tracker"); setProfileMenuOpen(false); }} className="block w-full text-left px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors">Course Tracker</button>
                                                <Link href="/planner" className="block px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>Semester Planner</Link>
                                                <Link href="/resources" className="block px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>Resources</Link>
                                                <Link href="/planner/settings" className="block px-3 py-2 text-sm text-[#222d32] hover:bg-[#edf1f6] rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>Profile & Settings</Link>
                                                {isAdmin && (
                                                    <Link href="/admin/dashboard" className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#dc4835] hover:bg-[#dc4835]/10 rounded transition-colors" onClick={() => setProfileMenuOpen(false)}>
                                                        <ShieldCheck className="w-4 h-4" /> Admin Dashboard
                                                    </Link>
                                                )}
                                                <div className="h-px bg-[#dde3ec] my-1" />
                                                <button onClick={() => void signOut({ callbackUrl: '/' })} className="w-full text-left px-3 py-2 text-sm text-[#dc4835] hover:bg-[#edf1f6] rounded transition-colors">Sign out</button>
                                            </div>
                                        )}
                                    </div>
                            </div>
                        </div>
                    </header>

                    <main className="flex-1">
                        <CourseTrackerView
                            data={courseData}
                            studentId={studentId!}
                            majorKey={major!}
                            rules={rules}
                            completedCourses={completedCourses}
                            toggleCourse={toggleCourse}
                            updateCourseGrade={updateCourseGrade}
                            saveStatus={saveStatus}
                            previousGpaHistory={previousGpaHistory}
                            setPreviousGpaHistory={setPreviousGpaHistory}
                            resetProgress={() => {
                                setCompletedCourses(new Map());
                                debouncedSave(new Map());
                            }}
                        />
                    </main>
                </div>
            )}

            {appState === "course-tracker" && (!courseData || !rules) && (
                <Spinner message="Loading your curriculum..." />
            )}
        </>
    );
}

function Spinner({ message = "Syncing data..." }: Readonly<{ message?: string }>) {
    return (
        <div className="min-h-screen bg-[#edf1f6] px-5 py-8 sm:px-8 sm:py-10">
            <output className="relative z-10 mx-auto block w-full max-w-6xl space-y-6 animate-pulse" aria-label={message} aria-live="polite">
                <div className="rounded-xl border border-[#dde3ec] bg-white p-6 sm:p-8">
                    <div className="h-4 w-28 rounded-full bg-[#dde3ec] mb-4" />
                    <div className="h-10 w-2/3 rounded-xl bg-[#dde3ec] mb-3" />
                    <div className="h-4 w-1/2 rounded-lg bg-[#dde3ec]" />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-xl border border-[#dde3ec] bg-white p-5">
                        <div className="h-4 w-20 rounded-full bg-[#dde3ec] mb-4" />
                        <div className="h-7 w-16 rounded-lg bg-[#dde3ec] mb-4" />
                        <div className="h-3 w-full rounded-lg bg-[#dde3ec] mb-2" />
                        <div className="h-3 w-4/5 rounded-lg bg-[#dde3ec]" />
                    </div>
                    <div className="rounded-xl border border-[#dde3ec] bg-white p-5">
                        <div className="h-4 w-20 rounded-full bg-[#dde3ec] mb-4" />
                        <div className="h-7 w-16 rounded-lg bg-[#dde3ec] mb-4" />
                        <div className="h-3 w-full rounded-lg bg-[#dde3ec] mb-2" />
                        <div className="h-3 w-4/5 rounded-lg bg-[#dde3ec]" />
                    </div>
                    <div className="rounded-xl border border-[#dde3ec] bg-white p-5">
                        <div className="h-4 w-20 rounded-full bg-[#dde3ec] mb-4" />
                        <div className="h-7 w-16 rounded-lg bg-[#dde3ec] mb-4" />
                        <div className="h-3 w-full rounded-lg bg-[#dde3ec] mb-2" />
                        <div className="h-3 w-4/5 rounded-lg bg-[#dde3ec]" />
                    </div>
                </div>

                <div className="text-center text-[#5a6472] text-sm font-semibold tracking-wide">{message}</div>
                <span className="sr-only">{message}</span>
            </output>
        </div>
    );
}
