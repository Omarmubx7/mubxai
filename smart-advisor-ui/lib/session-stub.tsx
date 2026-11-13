"use client";

// Client-side session API. Mirrors the subset of `next-auth/react` that the app
// uses (`SessionProvider`, `useSession`, `signIn`, `signOut`) but talks to our
// own runtime-agnostic session endpoints instead of a stubbed package.

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export interface ClientSessionUser {
    id: string;
    db_id?: number;
    student_id?: string | null;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    provider?: string;
    role?: string | null;
}

export interface ClientSession {
    user: ClientSessionUser;
}

export type SessionStatus = "authenticated" | "unauthenticated" | "loading";

interface SessionContextValue {
    data: ClientSession | null;
    status: SessionStatus;
    refresh: () => Promise<ClientSession | null>;
}

interface SignInOptions {
    callbackUrl?: string;
    redirect?: boolean;
    student_id?: string;
    password?: string;
    is_claiming?: boolean | string;
    [key: string]: unknown;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
    children,
}: {
    children: ReactNode;
    /** Accepted for API compatibility with next-auth; unused. */
    basePath?: string;
    refetchInterval?: number;
    refetchOnWindowFocus?: boolean;
}) {
    const [data, setData] = useState<ClientSession | null>(null);
    const [status, setStatus] = useState<SessionStatus>("loading");

    const refresh = useCallback(async (): Promise<ClientSession | null> => {
        try {
            const res = await fetch("/api/auth/session", {
                cache: "no-store",
                credentials: "same-origin",
            });

            if (!res.ok) throw new Error(`Session request failed: ${res.status}`);

            const json = (await res.json()) as { user?: ClientSessionUser | null };

            if (json?.user) {
                const next: ClientSession = { user: json.user };
                setData(next);
                setStatus("authenticated");
                return next;
            }

            setData(null);
            setStatus("unauthenticated");
            return null;
        } catch {
            setData(null);
            setStatus("unauthenticated");
            return null;
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const value = useMemo<SessionContextValue>(
        () => ({ data, status, refresh }),
        [data, status, refresh]
    );

    return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
    const ctx = useContext(SessionContext);

    // Allow components rendered outside the provider (e.g. isolated tests).
    if (!ctx) {
        return {
            data: null as ClientSession | null,
            status: "unauthenticated" as SessionStatus,
            update: async () => null,
            refresh: async () => null,
        };
    }

    return {
        data: ctx.data,
        status: ctx.status,
        update: ctx.refresh,
        refresh: ctx.refresh,
    };
}

export async function signIn(
    provider?: string,
    options: SignInOptions = {}
): Promise<{ error?: string; ok?: boolean; url?: string }> {
    const callbackUrl = options.callbackUrl ?? "/";

    if (provider === "google") {
        const url = `/api/auth/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
        if (typeof window !== "undefined") {
            window.location.href = url;
        }
        return { ok: true, url };
    }

    if (provider === "credentials") {
        if (typeof window === "undefined") {
            return { error: "Credentials sign-in must run in the browser" };
        }

        try {
            const res = await fetch("/api/auth/signin/credentials", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                credentials: "same-origin",
                body: JSON.stringify({
                    student_id: options.student_id,
                    password: options.password,
                    is_claiming: options.is_claiming ?? false,
                }),
            });

            const json = (await res.json().catch(() => ({}))) as {
                ok?: boolean;
                error?: string;
            };

            if (!res.ok || !json.ok) {
                return { error: json.error || "Invalid ID or password." };
            }

            return { ok: true, url: callbackUrl };
        } catch {
            return { error: "Network error. Please try again." };
        }
    }

    return { error: `Unsupported provider: ${String(provider)}` };
}

export async function signOut(options?: { callbackUrl?: string }): Promise<{ ok: boolean }> {
    try {
        await fetch("/api/auth/signout", {
            method: "POST",
            headers: { Accept: "application/json" },
            credentials: "same-origin",
        });
    } catch {
        // Even if the request fails, clear the client state and leave the page.
    }

    if (typeof window !== "undefined") {
        window.location.href = options?.callbackUrl || "/";
    }

    return { ok: true };
}
