"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const DEDUPE_PREFIX = "mubxai:visitor:";

/**
 * Visitor analytics used to run in the root server layout via `headers()`,
 * which forced every page into dynamic SSR and wrote to the DB on each render.
 * Logging from the client keeps pages statically renderable and offloads the
 * DB write to a tiny dedicated endpoint instead of the page render itself.
 */
export default function VisitorBeacon() {
    const pathname = usePathname();

    useEffect(() => {
        if (!pathname) return;

        // One log per path per browser session is enough for traffic analytics.
        try {
            const key = `${DEDUPE_PREFIX}${pathname}`;
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
        } catch {
            // Storage can be unavailable (private mode); still send the beacon.
        }

        const payload = JSON.stringify({ path: pathname, ts: Date.now() });

        try {
            if (typeof navigator.sendBeacon === "function") {
                navigator.sendBeacon(
                    "/api/analytics/visitor",
                    new Blob([payload], { type: "application/json" })
                );
            } else {
                void fetch("/api/analytics/visitor", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: payload,
                    keepalive: true,
                }).catch(() => {});
            }
        } catch {
            // Analytics must never affect the page.
        }
    }, [pathname]);

    return null;
}
