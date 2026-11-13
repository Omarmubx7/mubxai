import { NextResponse, type NextRequest } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;
const NEXTAUTH_URL = process.env.NEXTAUTH_URL!;

const SCOPES = ["openid", "email", "profile"].join(" ");

export const dynamic = "force-dynamic";

function setCookie(
  res: NextResponse,
  name: string,
  value: string,
  maxAge: number,
  opts?: Record<string, unknown>
) {
  res.cookies.set(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    ...opts,
  });
}

function setSessionCookie(res: NextResponse, value: string, maxAge: number) {
  setCookie(res, "mubxai_session", value, maxAge);
}

function clearSessionCookie(res: NextResponse) {
  res.cookies.set("mubxai_session", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function signSession(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(NEXTAUTH_SECRET);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return Buffer.from(`${payload}.${sigHex}`).toString("base64url");
}

import { verifySession } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const action = searchParams.get("action"); // "start" | "callback"

  // ---- START: redirect user to Google ----
  if (action !== "callback") {
    const state = crypto.randomUUID();
    const res = NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: `${NEXTAUTH_URL}/api/auth/google?action=callback`,
        response_type: "code",
        scope: SCOPES,
        state,
        access_type: "offline",
        prompt: "consent",
      })}`
    );
    setCookie(res, "google_oauth_state", state, 10 * 60);
    // Also store callbackUrl so we can redirect after auth
    setCookie(res, "google_oauth_cb", callbackUrl, 10 * 60);
    return res;
  }

  // ---- CALLBACK: Google redirects back ----
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=google_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${origin}/login?error=google_no_code`);
  }

  // Verify state cookie (CSRF protection)
  const stateCookie = req.cookies.get("google_oauth_state")?.value;
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.redirect(`${origin}/login?error=google_state_mismatch`);
  }

  const cbCookie = req.cookies.get("google_oauth_cb")?.value || "/";

  try {
    // 1. Exchange authorization code for access token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${NEXTAUTH_URL}/api/auth/google?action=callback`,
      }),
    });

    if (!tokenRes.ok) {
      console.error("Google token exchange failed:", await tokenRes.text());
      return NextResponse.redirect(`${origin}/login?error=google_token_exchange`);
    }

    const tokens = await tokenRes.json();
    const accessToken = tokens.access_token as string;

    // 2. Fetch user profile from Google
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/login?error=google_userinfo`);
    }

    const user = await userRes.json();

    // 3. Create signed session
    const sessionPayload = JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.picture,
        provider: "google",
      },
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const sessionValue = await signSession(sessionPayload);

    // 4. Redirect back to app with session cookie set
    const res = NextResponse.redirect(cbCookie);
    setSessionCookie(res, sessionValue, 7 * 24 * 60 * 60);
    res.cookies.delete("google_oauth_state");
    res.cookies.delete("google_oauth_cb");
    return res;
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(`${origin}/login?error=google_callback`);
  }
}

export async function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
