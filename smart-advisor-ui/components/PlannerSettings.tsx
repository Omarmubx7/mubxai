"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "@/lib/session-stub";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Settings2, Calendar, RefreshCcw, Bell, User, Mail, GraduationCap, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useToast } from "./ui/Toast";
import ConfirmDialog from "./ui/ConfirmDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { fetchWithRetry, fetchJSON } from "@/lib/fetch-retry";

interface PlannerUserProfile {
    image?: string | null;
    name?: string | null;
    email?: string | null;
    student_id?: string | null;
    major?: string | null;
    role?: string | null;
}

interface GooglePreferences {
    sync_daily: boolean;
    exam_reminders: boolean;
    exam_reminders_days?: number;
}

interface PlannerSummaryResponse {
    user?: PlannerUserProfile;
    google_preferences?: GooglePreferences;
}

export default function PlannerSettings() {
    const { status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [calendarConnected, setCalendarConnected] = useState(false);
    const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [userProfile, setUserProfile] = useState<PlannerUserProfile | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [preferences, setPreferences] = useState<GooglePreferences>({
        sync_daily: false,
        exam_reminders: true
    });
    const { toast } = useToast();

    const checkIntegrationStatus = useCallback(async () => {
        try {
            const data = await fetchJSON<{ google_calendar?: boolean; google_account_email?: string }>("/api/connect/status", { retries: 2 });
            setCalendarConnected(data.google_calendar ?? false);
            setConnectedEmail(data.google_account_email || null);
        } catch (error) {
            console.error("Failed to check integration status", error);
            toast("Could not load integration status", "error");
        }
    }, [toast]);

    const fetchUserProfile = useCallback(async () => {
        try {
            const data = await fetchJSON<PlannerSummaryResponse>("/api/planner/summary", { retries: 2 });
            setUserProfile(data.user ?? null);
            if (data.google_preferences) {
                setPreferences({
                    sync_daily: data.google_preferences.sync_daily ?? false,
                    exam_reminders: data.google_preferences.exam_reminders ?? true
                });
            }
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            toast("Could not load profile settings", "error");
        }
    }, [toast]);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            checkIntegrationStatus();
            fetchUserProfile();
        }
    }, [status, router, checkIntegrationStatus, fetchUserProfile]);

    useEffect(() => {
        if (searchParams.get("connected") === "google") {
            toast("Google Calendar connected successfully!", "success");
            const currentPath = globalThis.location === undefined ? '/' : globalThis.location.pathname;
            router.replace(currentPath, { scroll: false });
            // Refresh integration status and profile to reflect connection immediately
            checkIntegrationStatus();
            fetchUserProfile();
        } else if (searchParams.get("error")) {
            const errCode = searchParams.get("error");
            if (errCode === "google_denied") {
                toast("Google Calendar connection was cancelled or denied.", "error");
            } else if (errCode === "google_token_failed") {
                toast("Google rejected the connection request. Please try again.", "error");
            } else if (errCode === "oauth_failed") {
                toast("Connection failed while saving your Google account. Please clear your browser cookies and try again.", "error");
            } else if (errCode === "invalid_state") {
                toast("Security check failed — your session may have expired. Please try connecting again.", "error");
            } else {
                toast("An unexpected error occurred while connecting to Google Calendar. Please try again.", "error");
            }
            const currentPath = globalThis.location === undefined ? '/' : globalThis.location.pathname;
            router.replace(currentPath, { scroll: false });
        }
    }, [searchParams, router, toast, checkIntegrationStatus, fetchUserProfile]);

    const handleGoogleConnect = () => {
        // Redirect to external Google OAuth flow specific to the calendar
        globalThis.location.href = `/api/connect/google?returnTo=${encodeURIComponent(globalThis.location.pathname)}`;
    };

    const handleSyncNow = async () => {
        if (!calendarConnected) return;
        setSyncing(true);
        try {
            const res = await fetch("/api/connect/google/sync", { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                toast(data.message || "Your schedule has been synced to Google Calendar.", "success");
            } else if (res.status === 401) {
                toast("Google Calendar disconnected. Please reconnect.", "error");
            } else {
                const data = await res.json().catch(() => ({}));
                toast(data.error || "Sync failed. Please try again.", "error");
            }
        } catch (error) {
            console.error(error);
            toast("Connection failed. Check your network and try again.", "error");
        } finally {
            setSyncing(false);
        }
    };

    const updatePreference = async (key: keyof GooglePreferences, val: GooglePreferences[keyof GooglePreferences]) => {
        if (!calendarConnected) return;
        
        const newPrefs: GooglePreferences = { ...preferences, [key]: val };
        setPreferences(newPrefs);

        try {
            await fetchWithRetry("/api/connect/google/preferences", {
                method: "POST",
                body: JSON.stringify({ preferences: newPrefs }),
                retries: 2
            });
            toast("Preferences saved.", "success");
        } catch (error) {
            console.error(error);
            toast(`Failed to save: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        }
    };

    const handleResetPlanner = async () => {
        setResetting(true);
        try {
            const res = await fetchWithRetry("/api/planner/reset", { 
                method: "DELETE",
                retries: 1
            });
            if (res.ok) {
                toast("Planner reset successfully. Refreshing dashboard...", "success");
                // Force a fresh route state so all widgets reflect reset data.
                router.replace(`/planner?reset=${Date.now()}`);
                router.refresh();
            } else {
                throw new Error(`Reset failed with status ${res.status}`);
            }
        } catch (error) {
            console.error(error);
            toast(`Reset failed: ${error instanceof Error ? error.message : 'Network error'}`, "error");
        } finally {
            setResetting(false);
            setShowResetConfirm(false);
        }
    };

    const currentExamReminderDays = preferences.exam_reminders_days ?? (preferences.exam_reminders ? 7 : 0);

    const displayStudentId = (() => {
        const studentId = userProfile?.student_id?.trim() || "";
        const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentId);
        // TODO: Sanitize student_id at write time in the backend OAuth/profile sync path.
        if (!studentId || looksLikeEmail) return "Not set yet";
        return studentId;
    })();
    const displayMajor = (userProfile?.major || "undecided").replaceAll('_', ' ');
    const displayRole = userProfile?.role?.trim() || "Student";

    const getInitials = (name?: string | null) => {
        if (!name) return "HT";
        const parts = name.trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return "HT";
        if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        return `${parts[0][0]}${parts.at(-1)?.[0] ?? "T"}`.toUpperCase();
    };

    return (
        <div className="min-h-screen bg-[#edf1f6] text-[#222d32] selection:bg-[#dc4835]/30 font-sans pb-24">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec] px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/planner" className="p-2 -ml-2 hover:bg-[#edf1f6] rounded-xl transition-all group">
                            <ArrowLeft className="w-5 h-5 text-[#5a6472] group-hover:text-[#222d32]" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#5a6472] mb-0.5">
                                <Link href="/planner" className="hover:text-[#222d32] transition-colors">Planner</Link>
                                <span>/</span>
                                <span className="text-[#dc4835]">Settings</span>
                            </div>
                            <h1 className="font-bold text-lg flex items-center gap-2 leading-none">
                                <Settings2 className="w-5 h-5 text-zinc-400" />
                                Profile & Preferences
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

                {/* Profile Card */}
                {userProfile && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4 flex items-center gap-2">
                            <User className="w-5 h-5 text-[#dc4835]" /> My Profile
                        </h3>

                        <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white flex flex-col md:flex-row gap-6">
                            <div className="w-20 h-20 rounded-full bg-linear-to-br from-[#dc4835] to-blue-600 p-1 shrink-0 self-center md:self-start">
                                {userProfile.image ? (
                                    <img src={userProfile.image} alt="Profile" width={80} height={80} className="w-full h-full rounded-full object-cover border-2 border-black" />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-[#edf1f6] flex items-center justify-center text-2xl font-black">
                                        {getInitials(userProfile.name)}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs text-[#5a6472] uppercase font-bold tracking-widest flex items-center gap-1.5"><User className="w-3 h-3" /> Full Name</p>
                                        <p className="text-sm font-bold text-[#222d32]">{userProfile.name || "HTU Student"}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-[#5a6472] uppercase font-bold tracking-widest flex items-center gap-1.5"><Mail className="w-3 h-3" /> Email Address</p>
                                        <p className="text-sm font-bold text-[#222d32]">{userProfile.email || 'Not connected'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-[#5a6472] uppercase font-bold tracking-widest flex items-center gap-1.5"><GraduationCap className="w-3 h-3" /> Student ID / Major</p>
                                        <p className="text-sm font-bold text-[#222d32]">
                                            {displayStudentId} • <span className="text-[#dc4835] capitalize">{displayMajor}</span>
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs text-[#5a6472] uppercase font-bold tracking-widest flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Account Role</p>
                                        <p className="text-sm font-bold text-emerald-400 capitalize">{displayRole}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Integration Card */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-400" /> External Integrations
                    </h3>

                    <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="font-bold text-base flex items-center gap-2">
                                    <span>Google Calendar</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest ${calendarConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {calendarConnected ? 'Connected' : 'Disconnected'}
                                    </span>
                                </h4>
                                {calendarConnected && connectedEmail && (
                                    <p className="text-xs font-mono text-blue-400/60 mt-0.5">Account: {connectedEmail}</p>
                                )}
                                <p className="text-sm text-[#5a6472] mt-1 max-w-sm">
                                    Automatically push your course schedules and exam dates securely to your external Google Calendar agenda.
                                </p>
                            </div>

                            {calendarConnected ? (
                                <button
                                    onClick={handleSyncNow} disabled={syncing}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all flex items-center justify-center sm:justify-start gap-2 shrink-0 w-full sm:w-auto"
                                >
                                    <RefreshCcw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                    {syncing ? 'Syncing...' : 'Force Sync Now'}
                                </button>
                            ) : (
                                <button
                                    onClick={handleGoogleConnect}
                                    className="px-6 py-3 bg-white text-black font-bold rounded-xl text-sm transition-all hover:bg-white/90 shrink-0 w-full sm:w-auto"
                                >
                                    Connect Account
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Google Sheets - Reserved Future Feature */}
                    <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-[#edf1f6] opacity-60">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="font-bold text-base flex items-center gap-2 text-[#5a6472]">
                                    <span>Google Sheets</span>
                                    <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest bg-[#edf1f6] text-[#5a6472]">Coming Soon</span>
                                </h4>
                                <p className="text-sm text-[#5a6472] mt-1 max-w-sm">
                                    Export your academic transcript and semester plans directly to a personal spreadsheet for custom analysis.
                                </p>
                            </div>
                            <button
                                disabled
                                className="px-6 py-3 bg-[#edf1f6] text-[#5a6472] font-bold rounded-xl text-sm cursor-not-allowed w-full sm:w-auto"
                            >
                                Available Soon
                            </button>
                        </div>
                    </div>
                </div>

                {/* Notification Preferences */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4 flex items-center gap-2">
                        <Bell className="w-5 h-5 text-amber-400" /> Notifications & Sync Rules
                    </h3>

                    <div className="glass-panel p-6 rounded-4xl border border-[#dde3ec] bg-white space-y-4 text-sm text-[#222d32]">
                        <div className="flex flex-col gap-2 border-b border-[#dde3ec] pb-4">
                            <div className="flex items-center justify-between gap-4">
                                <span>Sync daily classes dynamically</span>
                                <button
                                    onClick={() => updatePreference('sync_daily', !preferences.sync_daily)}
                                    disabled={!calendarConnected}
                                    aria-pressed={preferences.sync_daily}
                                    className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 ${preferences.sync_daily ? 'bg-emerald-500' : 'bg-[#dde3ec]'} ${calendarConnected ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed border border-[#dde3ec] pointer-events-none'}`}
                                >
                                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${preferences.sync_daily ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                            {!calendarConnected && (
                                <p className="text-[11px] text-[#5a6472]">Connect Google Calendar to enable automatic daily sync.</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                            <div className="flex items-center justify-between gap-4">
                                <span>Reminder for Exams (Before Date)</span>
                                <select
                                    value={currentExamReminderDays}
                                    onChange={(e) => updatePreference('exam_reminders_days', Number.parseInt(e.target.value))}
                                    disabled={!calendarConnected}
                                    className={`bg-[#edf1f6] border border-[#dde3ec] rounded-xl px-2 py-1 text-[#222d32] text-xs focus:outline-none ${!calendarConnected && 'opacity-50 cursor-not-allowed'}`}
                                >
                                    <option value={7}>7 Days</option>
                                    <option value={3}>3 Days</option>
                                    <option value={1}>1 Day</option>
                                    <option value={0}>Disabled</option>
                                </select>
                            </div>
                            {!calendarConnected && (
                                <p className="text-[11px] text-[#5a6472]">Connect Google Calendar to change exam reminder timing.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="space-y-4 pt-8">
                    <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4 flex items-center gap-2 text-red-500">
                        Danger Zone
                    </h3>
                    <div className="glass-panel p-6 rounded-4xl border border-red-500/20 bg-red-500/2">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            <div className="flex-1">
                                <h4 className="font-bold text-base text-red-400">Reset Semester Planner</h4>
                                <p className="text-sm text-[#5a6472] mt-1 max-w-sm">
                                    Permanently wipe all planned semesters, grades, study sessions, and notes inside this application. (Course Tracker sync is unaffected).
                                </p>
                            </div>
                            <button
                                onClick={() => setShowResetConfirm(true)} disabled={resetting}
                                className="px-6 py-3 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 disabled:opacity-50 text-red-400 font-bold rounded-xl text-sm transition-all shrink-0 w-full sm:w-auto"
                            >
                                {resetting ? 'Resetting...' : 'Reset Planner Now'}
                            </button>
                        </div>
                    </div>
                </div>

                <ConfirmDialog
                    isOpen={showResetConfirm}
                    title="Reset Planner?"
                    description="Are you absolutely sure you want to reset your planner? This cannot be undone and deletes all your organized terms and notes."
                    confirmLabel="Yes, Reset Everything"
                    variant="danger"
                    onConfirm={handleResetPlanner}
                    onCancel={() => setShowResetConfirm(false)}
                />

            </main >
        </div >
    );
}
