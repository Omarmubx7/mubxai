import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SCOPES = ["openid", "email", "profile"].join(" ");

/** Public origin of this request, honouring Cloudflare's proxy headers. */
function requestOrigin(req: NextRequest): string {
    const url = new URL(req.url);
    const proto =
        req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
        url.protocol.replace(":", "");
    const host =
        req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
        req.headers.get("host") ||
        url.host;
    return `${proto}://${host}`;
}

function safeRelativePath(value: string | null): string {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
}

/**
 * GET /api/auth/google?callbackUrl=/dashboard
 *
 * Starts the Google OAuth flow. The redirect URI is derived from the incoming
 * request (so localhost and production both work) and is pinned in a cookie so
 * that the token exchange sends the exact same value back to Google.
 */
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const origin = requestOrigin(req);
    const secure = origin.startsWith("https://");

    const loginError = (code: string) =>
        NextResponse.redirect(new URL(`/login?error=${code}`, origin));

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
        console.error("[google-auth] GOOGLE_CLIENT_ID is not configured");
        return loginError("google_not_configured");
    }

    const callbackUrl = safeRelativePath(searchParams.get("callbackUrl"));
    const redirectUri = `${origin}/api/auth/google/callback`;
    const state = crypto.randomUUID();

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        state,
        access_type: "online",
        include_granted_scopes: "true",
        prompt: "select_account",
    }).toString();

    const res = NextResponse.redirect(authUrl);
    const cookieOptions = {
        httpOnly: true,
        secure,
        sameSite: "lax" as const,
        path: "/",
        maxAge: 10 * 60,
    };

    res.cookies.set("google_oauth_state", state, cookieOptions);
    res.cookies.set("google_oauth_cb", callbackUrl, cookieOptions);
    res.cookies.set("google_oauth_redirect", redirectUri, cookieOptions);

    return res;
}
