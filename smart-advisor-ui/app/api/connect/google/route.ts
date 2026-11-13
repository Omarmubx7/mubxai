import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { getBaseUrl } from "@/lib/env";
import { encodeBase64UrlText, randomUrlSafeToken } from "@/lib/base64url";

// GET /api/integrations/google-calendar - Generates an OAuth url to connect Calendar
export async function GET(req: NextRequest): Promise<Response> {
    const session = await getSession();

    if (!session?.user) {
        return NextResponse.redirect(new URL("/?error=unauthorized", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${getBaseUrl(req)}/api/connect/google/callback`;
    const returnTo = req.nextUrl.searchParams.get("returnTo") || "/planner/settings";

    if (!clientId) {
        return NextResponse.redirect(new URL("/?error=google_not_configured", req.url));
    }

    // State is `<random>.<returnTo>`; the random half is echoed in a cookie and
    // compared in the callback. Both halves are URL-safe base64.
    const state = randomUrlSafeToken(32).toLowerCase();
    const stateValue = `${state}.${encodeBase64UrlText(returnTo)}`;

    // Append scopes
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("client_id", clientId);
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("scope", "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email");
    url.searchParams.append("access_type", "offline");
    url.searchParams.append("prompt", "consent");
    url.searchParams.append("state", stateValue);

    const response = NextResponse.redirect(url.toString());

    // Store state in cookie for verification
    response.cookies.set("oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600, // 10 minutes
        path: "/"
    });

    // Pin the exact redirect URI so the token exchange sends Google the same
    // value that was used to authorise, even behind a proxy that rewrites
    // forwarded headers.
    response.cookies.set("oauth_redirect_uri", redirectUri, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 600,
        path: "/"
    });

    return response;
}
