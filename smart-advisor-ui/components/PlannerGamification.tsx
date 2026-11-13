"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/lib/session-stub";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trophy, Star, Target, Crown, Flame } from "lucide-react";
import Link from "next/link";
import { fetchWithRetry } from "@/lib/fetch-retry";

interface GamificationProfile {
    level: number;
    xp: number;
    current_streak_days: number;
    longest_streak_days: number;
}

interface QuestItem {
    id: number;
    type: string;
    current_value: number;
    target_value: number;
    scope: string;
    status: string;
    expires_at?: string | null;
}

interface BadgeItem {
    name: string;
    description?: string | null;
}

interface GamificationStats {
    profile: GamificationProfile;
    badges: BadgeItem[];
    quests: QuestItem[];
}

export default function PlannerGamification() {
    const { status } = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<GamificationStats | null>(null);

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/");
        } else if (status === "authenticated") {
            fetchStats();
        }
    }, [status, router]);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const [profRes, questRes] = await Promise.all([
                fetchWithRetry("/api/gamification/profile", { retries: 2 }),
                fetchWithRetry("/api/gamification/quests", { retries: 2 })
            ]);

            if (profRes.ok && questRes.ok) {
                const profileData = await profRes.json() as { profile: GamificationProfile; badges: BadgeItem[] };
                const questsData = await questRes.json() as { quests: QuestItem[] };
                setStats({ ...profileData, quests: questsData.quests });
            } else {
                throw new Error('Failed to fetch gamification data');
            }
        } catch (error) {
            console.error('Failed to load gamification data', error);
            alert("Failed to load gamification data.");
        } finally {
            setLoading(false);
        }
    };

    if (loading || !stats) {
        return (
            <div className="min-h-screen bg-[#edf1f6] flex items-center justify-center">
                <div className="w-8 h-8 rounded-xl bg-white animate-pulse" />
            </div>
        );
    }

    const { profile, badges, quests } = stats;

    return (
        <div className="min-h-screen bg-[#edf1f6] text-[#222d32] selection:bg-[#dc4835]/30 font-sans pb-24">
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#dde3ec] px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/planner" className="p-2 -ml-2 hover:bg-[#edf1f6] rounded-xl transition-all group">
                            <ArrowLeft className="w-5 h-5 text-[#5a6472] group-hover:text-[#222d32]" />
                        </Link>
                        <div>
                            <h1 className="font-bold text-lg flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-yellow-400" />
                                Achievements
                            </h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
                {/* Hero Stats */}
                <div className="glass-panel p-8 rounded-[2rem] border border-[#dde3ec] bg-linear-to-br from-[#dc4835]/10 to-transparent flex flex-col sm:flex-row items-center gap-8 justify-center text-center sm:text-left relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 text-[#222d32]/5 pointer-events-none">
                        <Crown className="w-64 h-64" />
                    </div>

                    <div className="w-32 h-32 rounded-full border-4 border-[#dc4835] flex flex-col items-center justify-center shadow-[0_0_50px_rgba(220,72,53,0.3)] bg-white z-10 shrink-0">
                        <span className="text-xs text-[#5a6472] uppercase tracking-widest font-bold">Level</span>
                        <span className="text-5xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-linear-to-b from-[#222d32] to-[#222d32]/60">{profile.level}</span>
                    </div>

                    <div className="space-y-4 z-10">
                        <div>
                            <h2 className="text-3xl font-black">{profile.xp} <span className="text-[#dc4835]">XP</span></h2>
                            <p className="text-sm font-medium text-[#5a6472]">Total Experience Points</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                <Flame className="w-4 h-4 text-orange-400" />
                                <span className="font-bold text-orange-400 text-sm">{profile.current_streak_days} Day Streak</span>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                                <Trophy className="w-4 h-4 text-blue-400" />
                                <span className="font-bold text-blue-400 text-sm">Best: {profile.longest_streak_days} Days</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quests */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-emerald-400" /> Active Quests
                    </h3>

                    {quests.map((quest: QuestItem) => {
                        const progressPercent = Math.min((quest.current_value / quest.target_value) * 100, 100);
                        return (
                            <div key={quest.id} className="bg-white border border-[#dde3ec] rounded-2xl p-5 hover:border-[#dde3ec] transition-all">
                                <div className="flex justify-between items-end mb-3">
                                    <div>
                                        <h4 className="font-bold capitalize">{quest.type.replace('_', ' ')}</h4>
                                        <p className="text-xs text-[#5a6472] mt-1">
                                            {quest.scope} Scope • {quest.status}
                                            {quest.expires_at && ` • Expires: ${new Date(quest.expires_at).toLocaleDateString()}`}
                                        </p>
                                    </div>
                                    <span className="text-sm font-bold font-mono">{quest.current_value} / {quest.target_value}</span>
                                </div>
                                <div className="h-2 w-full bg-[#dde3ec] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Badges */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold font-display tracking-tight border-b border-[#dde3ec] pb-2 mb-4 flex items-center gap-2">
                        <Star className="w-5 h-5 text-blue-400" /> Earned Badges
                    </h3>

                    {badges?.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {badges.map((badge: BadgeItem, i: number) => (
                                <div key={i} className="flex flex-col items-center justify-center p-6 bg-white rounded-[2rem] border border-[#dde3ec] text-center group">
                                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                        <Trophy className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-sm leading-tight">{badge.name}</h4>
                                    {badge.description && (
                                        <p className="text-xs text-[#5a6472] mt-2 leading-tight">{badge.description}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 border border-dashed border-[#dde3ec] rounded-3xl flex flex-col items-center justify-center text-center opacity-60">
                            <Star className="w-8 h-8 text-[#5a6472] mb-3" />
                            <p className="text-sm font-bold">No badges yet.</p>
                            <p className="text-xs font-medium text-[#5a6472] max-w-xs mt-1">Keep studying and logging sessions to unlock achievements!</p>
                        </div>
                    )}
                </div>

            </main>
        </div>
    );
}
