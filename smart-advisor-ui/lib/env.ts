
import { NextRequest } from "next/server";

export function requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}


const ALLOWED_HOSTS = [
    'localhost:3000',
    process.env.NEXTAUTH_URL?.replace(/https?:\/\//, '')
].filter(Boolean) as string[];

export function getBaseUrl(req?: Request | NextRequest) {
    // 1. If on the client, always use window.location.origin
    if (globalThis.window !== undefined) {
        return globalThis.window.location.origin;
    }

    // 2. If we have a request, extract origin from it (handles localhost ports correctly)
    if (req) {
        try {
            // Check for proxy headers first (Cloudflare / nginx)
            const forwardedHost = req.headers.get("x-forwarded-host");
            const forwardedProto = req.headers.get("x-forwarded-proto") || "https";

            if (forwardedHost) {
                // Validate against allowed hosts (handle ports in forwardedHost)
                const hostWithoutPort = forwardedHost.split(':')[0];
                const isAllowed = ALLOWED_HOSTS.some(allowed => {
                    const allowedWithoutPort = allowed.split(':')[0];
                    return allowedWithoutPort === hostWithoutPort;
                });
                if (isAllowed) {
                    return `${forwardedProto}://${forwardedHost}`;
                }
                // Fall through to default URL
            }

            // Fallback to the actual URL origin of the request
            const url = new URL(req.url);
            return url.origin;
        } catch {
            return 'http://localhost:3000';
        }
    }

    // 3. Fallback to env variables (for background tasks/server-only logic)
    if (process.env.NEXTAUTH_URL) {
        return process.env.NEXTAUTH_URL;
    }

    // Ultimate fallback (unlikely to be hit if req is passed)
    return 'http://localhost:3000';
}

