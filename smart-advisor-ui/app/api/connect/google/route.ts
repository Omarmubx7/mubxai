import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getBaseUrl } from "@/lib/env";

// GET /api/integrations/google-calendar — Generates an OAuth url to connect Calendar
export async function GET(req: NextRequest): Promise<Response> {
    const session = await getServerSession();

    if (!session?.user) {
        return NextResponse.redirect(new URL("/?error=unauthorized", req.url));
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = `${getBaseUrl(req)}/api/connect/google/callback`;
    const returnTo = req.nextUrl.searchParams.get("returnTo") || "/planner/settings";

    if (!clientId) {
        return NextResponse.redirect(new URL("/?error=google_not_configured", req.url));
    }

    // Generate secure state parameter to prevent CSRF using Web Crypto API
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const state = btoa(String.fromCodePoint(...array)).replaceAll(/[=+/]/g, "").toLowerCase();
    const returnToEncoded = Buffer.from(returnTo).toString("base64url");
    const stateValue = `${state}.${returnToEncoded}`;

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

    return response;
}
