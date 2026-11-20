import { NextResponse, type NextRequest } from "next/server";
import { getClientInfo } from "@/lib/client-info";
import { logVisitor } from "@/lib/database";

export const dynamic = "force-dynamic";

// Lightweight per-isolate throttle. Beacons are best-effort analytics, so
// duplicate/noisy calls should never turn into extra database writes.
const THROTTLE_MS = 60_000;
const lastLoggedAt = new Map<string, number>();

export async function POST(_request: NextRequest) {
    try {
        const info = await getClientInfo();
        const key = info.ip_address || "unknown";
        const now = Date.now();

        if (now - (lastLoggedAt.get(key) ?? 0) < THROTTLE_MS) {
            return new NextResponse(null, { status: 204 });
        }
        lastLoggedAt.set(key, now);
        if (lastLoggedAt.size > 2_000) lastLoggedAt.clear();

        await logVisitor(info);
    } catch {
        // Never let analytics break a page view.
    }

    return new NextResponse(null, { status: 204 });
}
