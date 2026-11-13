"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Lock, User, AlertCircle } from "lucide-react";
import { signIn } from "@/lib/session-stub";
import Image from "next/image";

/**
 * Reads the `?callbackUrl=` query the auth-gate redirects with, so a user sent
 * from the Resources "Upload" button lands back on the page they were on.
 * Only same-origin relative paths are honoured (open-redirect guard).
 */
function getCallbackUrl(): string {
    if (typeof window === "undefined") return "/";
    const cb = new URLSearchParams(window.location.search).get("callbackUrl");
    return cb && cb.startsWith("/") && !cb.startsWith("//") ? cb : "/";
}

export default function StudentLogin() {
    const [id, setId] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isClaiming, setIsClaiming] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: { preventDefault: () => void }) => {
        e.preventDefault();
        void (async () => {
            const cleanId = id.trim();
            if (!cleanId || cleanId.length < 5) {
                setError("Please enter a valid university ID.");
                return;
            }
            if (!password || password.length < 6) {
                setError("Password must be at least 6 characters.");
                return;
            }

            setError("");
            setLoading(true);

            try {
                const result = await signIn("credentials", {
                    student_id: cleanId,
                    password,
                    is_claiming: isClaiming ? "true" : "false",
                    redirect: false,
                });

                if (result?.error) {
                    setError(isClaiming ? "Account already exists or invalid data." : "Invalid ID or password.");
                } else {
                    // Hard navigate so the SessionProvider re-reads the new auth cookie.
                    // router.refresh() does NOT update useSession() status — only a full
                    // page reload causes next-auth to re-fetch /api/auth/session properly.
                    window.location.href = getCallbackUrl();
                    return; // leave loading=true (we're navigating away anyway)
                }
            } catch (err) {
                console.error("Login failed", err);
                setError("Something went wrong. Please try again.");
            } finally {
                setLoading(false);
            }
        })();
    };

    let submitLabel = "Enter Dashboard";
    if (loading) submitLabel = "Initializing...";
    else if (isClaiming) submitLabel = "Verify & Claim";

    return (
        <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
            {/* Clean solid page background */}
            <div className="absolute inset-0 bg-[#edf1f6] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative w-full max-w-100 z-10"
            >
                {/* Badge */}
                <div className="flex justify-center mb-6">
                    <span className="pill-badge-premium">
                        <Image src="/mubxai-dark-logo.png" alt="MUBXAI Logo" width={16} height={16} className="dark-logo" />
                        <Image src="/mubxai-light-logo.png" alt="MUBXAI Logo" width={16} height={16} className="light-logo" />
                        MUBXAI
                    </span>
                </div>

                <div className="premium-card p-8 md:p-10 relative overflow-hidden bg-white border border-[#dde3ec] rounded-xl" style={{ boxShadow: '0 2px 8px rgba(34,45,50,0.07)' }}>
                    {/* Solid border instead of gradient flare */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#dc4835]" />

                    <div className="text-center mb-10">
                        <AnimatePresence>
                            <motion.h1
                                key={isClaiming ? "claim" : "login"}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="text-2xl sm:text-3xl font-extrabold text-[#222d32] mb-2 tracking-tight leading-none"
                            >
                                {isClaiming ? "Start Your HTU Journey" : "MUBXAI Login"}
                            </motion.h1>
                        </AnimatePresence>
                        <p className="text-sm text-[#92604c] font-semibold">
                            {isClaiming
                                ? "Link your university ID to start tracking."
                                : "Sign in to access your MUBXAI dashboard."}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-4">
                            <div className="relative group">
                                <label htmlFor="student_id" className="sr-only">University ID</label>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92604c] group-focus-within:text-[#c249a8] transition-colors">
                                    <User className="w-4.5 h-4.5" aria-hidden="true" />
                                </div>
                                <input
                                    id="student_id"
                                    type="text"
                                    value={id}
                                    onChange={(e) => { setId(e.target.value); setError(""); }}
                                    placeholder="University ID"
                                    autoComplete="username"
                                    aria-required="true"
                                    aria-invalid={!!error}
                                    aria-describedby={error ? "login-error" : undefined}
                                    className="w-full bg-[#edf1f6] border border-[#dde3ec] rounded-lg py-4 pl-12 pr-4 text-[#222d32] placeholder-gray-500 outline-none transition-all focus:bg-white focus:border-[#dc4835] text-sm font-medium"
                                />
                            </div>

                            <div className="relative group">
                                <label htmlFor="password" className="sr-only">Password</label>
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#92604c] group-focus-within:text-[#c249a8] transition-colors">
                                    <Lock className="w-4.5 h-4.5" aria-hidden="true" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                    placeholder="Secure Password"
                                    autoComplete={isClaiming ? "new-password" : "current-password"}
                                    aria-required="true"
                                    aria-invalid={!!error}
                                    aria-describedby={error ? "login-error" : undefined}
                                    className="w-full bg-[#edf1f6] border border-[#dde3ec] rounded-lg py-4 pl-12 pr-4 text-[#222d32] placeholder-gray-500 outline-none transition-all focus:bg-white focus:border-[#dc4835] text-sm font-medium"
                                />
                            </div>
                        </div>

                        {error && (
                            <motion.p
                                id="login-error"
                                role="alert"
                                initial={{ opacity: 0, x: -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="text-[11px] font-semibold text-red-600 text-center"
                            >
                                {error}
                            </motion.p>
                        )}

                        <motion.button
                            disabled={loading}
                            whileHover={{ scale: 1.01, y: -1 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            aria-label={isClaiming ? "Verify and Claim Account" : "Sign into Dashboard"}
                            className="w-full relative group overflow-hidden py-4 rounded-lg bg-[#dc4835] text-white font-bold text-sm transition-all hover:bg-[#fe1f11] disabled:opacity-50 mt-4 flex items-center justify-center gap-2 border border-[#dc4835]"
                        >
                            {submitLabel}
                            {!loading && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />}
                        </motion.button>
                    </form>

                    <div className="relative my-10 px-4">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-[#dde3ec]" /></div>
                        <div className="relative flex justify-center text-xs font-black uppercase tracking-[0.2em] text-[#92604c]">
                            <span className="bg-white px-4 py-1.5 rounded-full border border-[#dde3ec]">Universal Login</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={async () => {
                                try {
                                    const result = await signIn('google', { callbackUrl: getCallbackUrl() });
                                    if (result?.error) {
                                        setError(result.error);
                                    } else if (result?.url) {
                                        // Fallback: if signIn doesn't navigate, force navigate
                                        window.location.href = result.url;
                                    }
                                } catch (err) {
                                    console.error('Google sign-in failed:', err);
                                    setError('Failed to start Google sign-in. Please try again.');
                                }
                            }}
                            aria-label="Continue with Google"
                            className="w-full flex items-center justify-center gap-3 py-4 rounded-lg bg-[#edf1f6] border border-[#dde3ec] text-[#222d32] text-sm font-semibold transition-all hover:bg-[#dde3ec] group"
                        >
                            <div className="w-6 h-6 flex items-center justify-center bg-[#dde3ec] rounded-full group-hover:bg-gray-300 transition-colors" aria-hidden="true">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                            </div>
                            Continue with Google
                        </motion.button>

                        <p className="text-center mt-2">
                            <button
                                type="button"
                                onClick={() => { setIsClaiming(!isClaiming); setId(""); setPassword(""); setError(""); }}
                                className="text-[11px] sm:text-xs uppercase tracking-wider font-bold text-[#c249a8] hover:text-[#a83692] transition-colors focus:outline-none focus:ring-1 focus:ring-[#c249a8]/40 rounded px-3 py-2 sm:px-2 sm:py-0.5"
                            >
                                {isClaiming
                                    ? "Already have an account? Login"
                                    : "First time? Sign up & Claim your progress"
                                }
                            </button>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
