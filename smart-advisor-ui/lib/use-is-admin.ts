"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/session-stub";
import { safeStorage } from "@/lib/safe-storage";

/**
 * True when the current visitor should see admin entry points.
 *
 * An admin is either:
 *  - a signed-in user whose DB `role` is "admin", or
 *  - someone who has already unlocked the admin area with the admin secret
 *    (the secret is remembered in sessionStorage by AdminGate).
 */
export function useIsAdmin(): boolean {
    const { data: session } = useSession();
    const [hasStoredSecret, setHasStoredSecret] = useState(false);

    useEffect(() => {
        try {
            setHasStoredSecret(Boolean(safeStorage.session.get("admin_secret")));
        } catch {
            setHasStoredSecret(false);
        }
    }, []);

    return session?.user?.role === "admin" || hasStoredSecret;
}
