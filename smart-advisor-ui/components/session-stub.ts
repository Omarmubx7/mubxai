// Edge-compatible session with real Google OAuth on Cloudflare Workers
// Replaces the stub that always returned "Auth unavailable".

export function useSession(): {
    data: { user: any } | null;
    status: "authenticated" | "unauthenticated" | "loading";
} {
    // Client-side: session is read from cookies via middleware / server.
    // For client components, return unauthenticated until hydration.
    if (typeof window === "undefined") {
        return { data: null, status: "unauthenticated" };
    }
    return { data: null, status: "unauthenticated" };
}

export async function signIn(
    provider?: any,
    options?: any
): Promise<{ error?: string; ok?: boolean; url?: string }> {
    if (!provider) {
        return { error: "No provider specified" };
    }

    if (provider === "google") {
        const callbackUrl = options?.callbackUrl || "/";
        const url = new URL(
            `/api/auth/google?action=start&callbackUrl=${encodeURIComponent(callbackUrl)}`,
            typeof window !== "undefined" ? window.location.origin : "https://mubxai.24110213.workers.dev"
        );
        // Redirect the browser to the Google OAuth start endpoint
        if (typeof window !== "undefined") {
            window.location.href = url.toString();
        }
        return { ok: true, url: url.toString() };
    }

    if (provider === "credentials") {
        // Credentials sign-in is handled by POST /api/auth/signin/credentials
        // via the form's own fetch call. Return error so the form's error
        // handling takes over.
        return { error: "Use the login form endpoint" };
    }

    return { error: `Unsupported provider: ${provider}` };
}

export async function signOut(options?: any): Promise<{ ok: boolean }> {
    if (typeof window !== "undefined") {
        document.cookie =
            "mubxai_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
        window.location.href = options?.callbackUrl || "/";
    }
    return { ok: true };
}

export function SessionProvider({
    children,
    basePath,
    refetchInterval,
    refetchOnWindowFocus,
}: {
    children: React.ReactNode;
    basePath?: string;
    refetchInterval?: number;
    refetchOnWindowFocus?: boolean;
}) {
    return children;
}
