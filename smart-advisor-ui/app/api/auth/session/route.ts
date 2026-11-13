import { NextResponse } from "next/server";
import { SESSION_MAX_AGE } from "@/lib/session";
import { getSession } from "@/lib/session-server";

export const dynamic = "force-dynamic";

/**
 * Returns the current session in the shape the client `useSession()` expects.
 * Always 200 with `{ user: null }` when signed out so clients never have to
 * special-case a 401.
 */
export async function GET() {
    const session = await getSession();

    if (!session) {
        return NextResponse.json(
            { user: null },
            { headers: { "Cache-Control": "no-store" } }
        );
    }

    return NextResponse.json(
        {
            user: session.user,
            expires: new Date(session.expires).toISOString(),
            maxAge: SESSION_MAX_AGE,
        },
        { headers: { "Cache-Control": "no-store" } }
    );
}
