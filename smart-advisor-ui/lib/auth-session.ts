// Server-side session verification helper.
// Kept for backwards compatibility; new code should use `@/lib/session-server`.

import { verifySessionToken } from "./session";

/** Verifies a raw session token. Returns `{ user }` or null. */
export async function verifySession(token: string): Promise<{ user: unknown } | null> {
    const session = await verifySessionToken(token);
    return session ? { user: session.user } : null;
}
