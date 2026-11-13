import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { saveIntegrationToken, initDB } from "@/lib/database";
import { getBaseUrl, requireEnv } from "@/lib/env";

interface GoogleTokenResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
}

interface GoogleProfile {
    email?: string;
    id?: string;
    name?: string;
}

/** Exchange an authorization code for Google OAuth tokens. */
async function exchangeCodeForTokens(code: string, redirectUri: string, clientId: string, clientSecret: string) {
    console.log("[Google OAuth] Exchanging code for tokens, redirect_uri:", redirectUri);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });

    if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("[Google OAuth] Token exchange failed:", tokenRes.status, errBody);
        return null;
    }

    const tokens = await tokenRes.json() as GoogleTokenResponse;

    if (!tokens.access_token) {
        console.error("[Google OAuth] Token response missing access_token:", JSON.stringify(tokens));
        return null;
    }

    return tokens;
}

/** Fetch the Google user profile using an access token. */
async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (profileRes.ok) {
        return await profileRes.json() as GoogleProfile;
    }

    console.warn("[Google OAuth] Profile fetch failed:", profileRes.status, await profileRes.text());
    return {};
}

/** Decode the returnTo URL from the state parameter. */
function decodeReturnTo(encoded?: string): string {
    if (!encoded) return "/planner/settings";
    try {
        const decoded = Buffer.from(encoded, "base64url").toString();
        // Security: only allow relative paths starting with /
        // Block external URLs (//host, scheme://host) and path traversal
        if (
            !decoded.startsWith("/") ||
            decoded.startsWith("//") ||
            decoded.includes("://") ||
            decoded.includes("\\")
        ) {
            return "/planner/settings";
        }
        return decoded;
    } catch {
        return "/planner/settings";
    }
}

// GET /api/connect/google/callback?code=...
// Google redirects here after the user authorizes
export async function GET(req: NextRequest) {
    const session = await getServerSession();

    if (!session?.user) {
        return NextResponse.redirect(new URL("/?error=unauthorized", req.url));
    }

    const studentId = session.user.db_id?.toString() || session.user.student_id || session.user.email;
    if (!studentId) {
        console.error("[Google OAuth] No user identity found in session:", JSON.stringify(session.user));
        return NextResponse.redirect(new URL("/?error=unauthorized", req.url));
    }

    const code = req.nextUrl.searchParams.get("code");
    const oauthError = req.nextUrl.searchParams.get("error");
    const stateParam = req.nextUrl.searchParams.get("state") || "";

    if (oauthError || !code) {
        const errUrl = new URL("/planner/settings", req.url);
        errUrl.searchParams.set("error", "google_denied");
        return NextResponse.redirect(errUrl);
    }

    // Verify state parameter to prevent CSRF
    const storedState = req.cookies.get("oauth_state")?.value;
    const [receivedState, returnToEncoded] = stateParam.split(".");

    if (!storedState || storedState !== receivedState) {
        return NextResponse.redirect(new URL("/?error=invalid_state", req.url));
    }

    const returnTo = decodeReturnTo(returnToEncoded);

    // Clear state cookie
    const response = NextResponse.redirect(new URL(returnTo, req.url));
    response.cookies.delete("oauth_state");

    try {
        await initDB();

        const redirectUri = `${getBaseUrl(req)}/api/connect/google/callback`;
        const clientId = requireEnv("GOOGLE_CLIENT_ID");
        const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

        const tokens = await exchangeCodeForTokens(code, redirectUri, clientId, clientSecret);
        if (!tokens) {
            const errUrl = new URL(returnTo, req.url);
            errUrl.searchParams.set("error", "google_token_failed");
            return NextResponse.redirect(errUrl);
        }

        const profile = await fetchGoogleProfile(tokens.access_token!);

        console.log("[Google OAuth] Saving token for user:", studentId, "email:", profile.email);

        await saveIntegrationToken({
            studentId,
            provider: "google_calendar",
            accessToken: tokens.access_token!,
            refreshToken: tokens.refresh_token || "",
            expiresAt: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : undefined,
            providerAccountId: profile.id,
            accountEmail: profile.email,
            studentName: profile.name
        });

        console.log("[Google OAuth] Token saved successfully for user:", studentId);

        const redirectUrl = new URL(returnTo, req.url);
        redirectUrl.searchParams.set("connected", "google");
        return NextResponse.redirect(redirectUrl);
    } catch (e: unknown) {
        console.error("[Google OAuth] Callback failed:", e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack : "");
        const errUrl = new URL(returnTo, req.url);
        errUrl.searchParams.set("error", "oauth_failed");
        return NextResponse.redirect(errUrl);
    }
}
