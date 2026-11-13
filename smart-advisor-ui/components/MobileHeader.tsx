"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/session-stub";
import { ChevronLeft } from "lucide-react";

interface MobileHeaderProps {
    title?: string;
    showBack?: boolean;
    backHref?: string;
}

export default function MobileHeader({ title, showBack = false, backHref }: Readonly<MobileHeaderProps>) {
    const pathname = usePathname();
    const router = useRouter();
    const { status } = useSession();

    // Hide on login/landing pages
    if (pathname === "/" && status === "unauthenticated") {
        return null;
    }

    // Hide on admin pages
    if (pathname?.startsWith("/admin")) {
        return null;
    }

    // Hide when there's nothing to show
    if (!showBack && !title) {
        return null;
    }

    // Only show on small screens
    return (
        <div className="sm:hidden fixed top-0 left-0 right-0 z-60 bg-white/90 backdrop-blur-xl border-b border-[#dde3ec] shadow-xs" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div className="px-4 py-3 flex items-center gap-3">
                {showBack && (
                    <button
                        onClick={() => {
                            if (backHref) {
                                router.push(backHref);
                            } else {
                                router.back();
                            }
                        }}
                        className="p-2 hover:bg-[#edf1f6] rounded-lg transition-colors flex-shrink-0"
                        title="Go back"
                        aria-label="Go back"
                    >
                        <ChevronLeft className="w-5 h-5 text-[#222d32]" />
                    </button>
                )}

                {title && (
                    <h1 className="flex-1 text-sm font-bold text-[#222d32] truncate text-center min-w-0">{title}</h1>
                )}
            </div>
        </div>
    );
}
