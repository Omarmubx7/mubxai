import { NextResponse, type NextRequest } from "next/server";

function generateNonce(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Use btoa for Edge Runtime compatibility (Buffer not available in middleware)
    return btoa(String.fromCodePoint(...bytes));
}

export function middleware(request: NextRequest) {
    // In development, skip CSP so that React hydration & HMR aren't blocked
    if (process.env.NODE_ENV !== "production") {
        const response = NextResponse.next();
        response.headers.set("X-Frame-Options", "SAMEORIGIN");
        response.headers.set("X-Content-Type-Options", "nosniff");
        return response;
    }

    const nonce = generateNonce();

    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' https://www.googletagmanager.com https://accounts.google.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai;
        img-src 'self' data: https:;
        connect-src 'self' https://*.r2.cloudflarestorage.com https://geoip.cactusglobal.io https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com wss://ws-us3.pusher.com wss://ws-eu.pusher.com https://api-us3.pusher.com https://api-eu.pusher.com https://sockjs-us3.pusher.com https://sockjs-eu.pusher.com;
        frame-src 'self' https://www.youtube.com https://accounts.google.com;
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'none';
    `.replaceAll(/\s+/g, ' ');

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);

    const response = NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });

    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("X-Frame-Options", "SAMEORIGIN");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");

    return response;
}

export const config = {
    matcher: [
        {
            source: "/((?!_next/static|_next/image|favicon.ico|api/auth/).*)",
            missing: [
                { type: "header", key: "next-router-prefetch" },
                { type: "header", key: "purpose", value: "prefetch" },
            ],
        },
    ],
};
