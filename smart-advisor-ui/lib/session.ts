// Single, runtime-agnostic session implementation used by both the Edge
// middleware-compatible route handlers and the Node route handlers.
//
// The session is a compact JWS-like token:
//   base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
//
// It only uses Web Crypto + btoa/atob, so it runs on Cloudflare Workers,
// the Edge runtime and Node alike. No Buffer, no next-auth.

export const SESSION_COOKIE = "mubxai_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
    /** Stable identity string. DB id when known, Google subject otherwise. */
    id: string;
    /** Database primary key, when the user exists in our database. */
    db_id?: number;
    student_id?: string | null;
    email?: string | null;
    name?: string | null;
    image?: string | null;
    provider?: string;
    role?: string | null;
}

export interface AppSession {
    user: SessionUser;
    /** Unix epoch milliseconds. */
    expires: number;
}

function getSecret(): string {
    const secret = (process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "").trim();
    if (secret) return secret;

    if (process.env.NODE_ENV === "production") {
        throw new Error("[session] NEXTAUTH_SECRET is not configured");
    }

    // Local development fallback so `next dev` works even without a .env file.
    return "dev-secret-key-do-not-use-in-production";
}

function bytesToBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

async function importKey(): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(getSecret()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i += 1) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

/** Creates a signed session token for the given user. */
export async function createSessionToken(user: SessionUser): Promise<string> {
    const session: AppSession = {
        user,
        expires: Date.now() + SESSION_MAX_AGE * 1000,
    };

    const payload = bytesToBase64Url(
        new TextEncoder().encode(JSON.stringify(session))
    );
    const signature = await crypto.subtle.sign(
        "HMAC",
        await importKey(),
        new TextEncoder().encode(payload)
    );

    return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/** Verifies a session token. Returns null for anything invalid or expired. */
export async function verifySessionToken(token: string): Promise<AppSession | null> {
    try {
        const dot = token.indexOf(".");
        if (dot <= 0 || dot === token.length - 1) return null;

        const payload = token.slice(0, dot);
        const providedSignature = base64UrlToBytes(token.slice(dot + 1));

        const expected = await crypto.subtle.sign(
            "HMAC",
            await importKey(),
            new TextEncoder().encode(payload)
        );

        if (!constantTimeEqual(new Uint8Array(expected), providedSignature)) {
            return null;
        }

        const raw = new TextDecoder().decode(base64UrlToBytes(payload));
        const parsed = JSON.parse(raw) as AppSession;

        if (!parsed?.user || typeof parsed.expires !== "number") return null;
        if (Date.now() > parsed.expires) return null;

        return parsed;
    } catch {
        return null;
    }
}

/**
 * Cookie options for the session cookie.
 *
 * `secure` must only be enabled over HTTPS: browsers reject Secure cookies on
 * plain-HTTP origins (Safari even on localhost), which silently broke the
 * sign-in flow during local development.
 */
export function sessionCookieOptions(secure: boolean) {
    return {
        httpOnly: true,
        secure,
        sameSite: "lax" as const,
        path: "/",
        maxAge: SESSION_MAX_AGE,
    };
}
