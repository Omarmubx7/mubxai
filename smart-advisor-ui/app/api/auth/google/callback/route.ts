import { NextResponse, type NextRequest } from "next/server";
import { createUser, getUserByEmail, linkAccount } from "@/lib/database";
import { setSessionOnResponse } from "@/lib/session-server";
import type { SessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface GoogleTokenResponse {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
}

interface GoogleUserInfo {
    id: string;
    email?: string;
    verified_email?: boolean;
    name?: string;
    picture?: string;
}

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

/**
 * GET /api/auth/google/callback
 *
 * Handles Google's redirect: validates state, exchanges the authorization code
 * for tokens, links/creates the database user and issues our session cookie.
 */
export async function GET(req: NextRequest) {
    const origin = requestOrigin(req);
    const secure = origin.startsWith("https://");
    const { searchParams } = new URL(req.url);

    const redirectToLogin = (code: string, detail?: string) => {
        const url = new URL("/login", origin);
        url.searchParams.set("error", code);
        if (detail) url.searchParams.set("detail", detail.slice(0, 300));
        return NextResponse.redirect(url);
    };

    const googleError = searchParams.get("error");
    if (googleError) {
        return redirectToLogin("google_denied", googleError);
    }

    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (!code || !state) {
        return redirectToLogin("google_no_code");
    }

    const stateCookie = req.cookies.get("google_oauth_state")?.value;
    if (!stateCookie || stateCookie !== state) {
        return redirectToLogin("google_state_mismatch");
    }

    const callbackUrl = req.cookies.get("google_oauth_cb")?.value || "/";
    const redirectUri =
        req.cookies.get("google_oauth_redirect")?.value ||
        `${origin}/api/auth/google/callback`;

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        console.error("[google-auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing");
        return redirectToLogin("google_not_configured");
    }

    try {
        // 1. Exchange the authorization code for tokens.
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
            }),
            cache: "no-store",
        });

        const tokens = (await tokenRes.json().catch(() => ({}))) as GoogleTokenResponse;

        if (!tokenRes.ok || !tokens.access_token) {
            // Surface Google's own error so the cause is obvious in the logs
            // (invalid_client = rotated/wrong secret, redirect_uri_mismatch, ...).
            console.error(
                "[google-auth] token exchange failed:",
                tokenRes.status,
                tokens.error,
                tokens.error_description
            );
            return redirectToLogin(
                "google_token_exchange",
                tokens.error || `http_${tokenRes.status}`
            );
        }

        // 2. Fetch the profile.
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
            cache: "no-store",
        });

        if (!userRes.ok) {
            console.error("[google-auth] userinfo failed:", userRes.status);
            return redirectToLogin("google_userinfo", `http_${userRes.status}`);
        }

        const profile = (await userRes.json()) as GoogleUserInfo;
        if (!profile.email) {
            return redirectToLogin("google_no_email");
        }
        if (profile.verified_email === false) {
            return redirectToLogin("google_email_unverified");
        }

        // 3. Link or create the database user. Auth must still succeed if the
        //    database is temporarily unavailable, but a banned user is refused.
        let dbUser = null;
        try {
            dbUser = await getUserByEmail(profile.email);
            if (dbUser?.role === "banned") {
                return redirectToLogin("account_banned");
            }
            if (!dbUser) {
                dbUser = await createUser({
                    email: profile.email,
                    name: profile.name ?? null,
                    image: profile.picture ?? null,
                });
            }
            if (dbUser?.id) {
                await linkAccount(dbUser.id, "google", profile.id);
            }
        } catch (dbError) {
            console.error("[google-auth] database sync failed:", dbError);
        }

        const user: SessionUser = {
            id: dbUser?.id ? String(dbUser.id) : profile.id,
            db_id: dbUser?.id,
            student_id: dbUser?.student_id ?? null,
            email: profile.email,
            name: dbUser?.name ?? profile.name ?? null,
            image: dbUser?.image ?? profile.picture ?? null,
            provider: "google",
            role: dbUser?.role ?? "student",
        };

        // 4. Redirect back into the app with the session cookie set.
        const target =
            callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
                ? callbackUrl
                : "/";
        const res = NextResponse.redirect(new URL(target, origin));
        await setSessionOnResponse(res, user, secure);

        res.cookies.delete("google_oauth_state");
        res.cookies.delete("google_oauth_cb");
        res.cookies.delete("google_oauth_redirect");

        return res;
    } catch (error) {
        console.error("[google-auth] callback error:", error);
        return redirectToLogin("google_callback");
    }
}
