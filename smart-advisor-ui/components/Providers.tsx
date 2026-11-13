"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/session-stub";
import { ToastProvider } from "@/components/ui/Toast";

export function Providers({ children }: { readonly children: ReactNode }) {
    return (
        <SessionProvider>
            <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
    );
}
