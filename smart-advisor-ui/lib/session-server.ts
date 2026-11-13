// Server-side helpers for reading the current session inside Server Components
// and Route Handlers.

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
    SESSION_COOKIE,
    SESSION_MAX_AGE,
    createSessionToken,
    sessionCookieOptions,
    verifySessionToken,
    type AppSession,
    type SessionUser,
} from "./session";

/** Returns the current session, or null when signed out / invalid. */
export async function getSession(): Promise<AppSession | null> {
    try {
        const store = await cookies();
        const token = store.get(SESSION_COOKIE)?.value;
        if (!token) return null;
        return await verifySessionToken(token);
    } catch {
        return null;
    }
}

/** Signs a user in by setting the session cookie on a response. */
export async function setSessionOnResponse(
    response: NextResponse,
    user: SessionUser,
    secure: boolean
): Promise<void> {
    const token = await createSessionToken(user);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
}

/** Clears every auth-related cookie we have ever issued. */
export function clearSessionOnResponse(response: NextResponse, secure: boolean): void {
    const expired = { ...sessionCookieOptions(secure), maxAge: 0 };

    response.cookies.set(SESSION_COOKIE, "", expired);

    // Remove leftovers from the old NextAuth-based implementation so a stale
    // token can never resurrect a signed-out session.
    for (const name of [
        "next-auth.session-token",
        "__Secure-next-auth.session-token",
        "next-auth.callback-url",
        "__Secure-next-auth.callback-url",
        "next-auth.csrf-token",
        "__Host-next-auth.csrf-token",
    ]) {
        response.cookies.set(name, "", expired);
    }
}

export { SESSION_COOKIE, SESSION_MAX_AGE };
export type { AppSession, SessionUser };
