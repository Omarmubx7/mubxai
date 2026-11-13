"use client";

import React from "react";
import { motion } from "framer-motion";
import { Home, CalendarDays, Settings2, LogOut, Bot, BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "@/lib/session-stub";

const NAV_ITEMS = [
    { label: "Tracker", icon: Home, href: "/" },
    { label: "Planner", icon: CalendarDays, href: "/planner" },
    { label: "Bot", icon: Bot, href: "https://bot.mubx.dev", external: true },
    { label: "Resources", icon: BookOpen, href: "/resources" },
    { label: "Settings", icon: Settings2, href: "/planner/settings" },
];

export default function MobileNav() {
    const pathname = usePathname();
    const { status } = useSession();

    if (status !== "authenticated") {
        return null;
    }

    return (
        <nav
            id="wt-mobile-nav"
            className="sm:hidden fixed bottom-0 left-0 right-0 z-70 flex justify-center bg-white/95 backdrop-blur-2xl border-t border-[#dde3ec]"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
            <div className="w-full max-w-lg flex items-center justify-around px-2 pt-2 pb-1">
                {NAV_ITEMS.map((item) => {
                    const isActive = item.external ? false : pathname === item.href || (item.href === "/" && pathname === "/");

                    const linkProps = item.external
                        ? { href: item.href, target: "_blank", rel: "noopener noreferrer" }
                        : { href: item.href };

                    return (
                        <Link
                            key={item.label}
                            {...linkProps}
                            className="relative flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 group transition-all min-w-0"
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activeTabMobile"
                                    className="absolute inset-0 bg-[#dc4835]/10 rounded-xl border border-[#dc4835]/20"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}

                            <div className={`relative z-10 p-1.5 rounded-xl transition-all ${isActive ? "text-[#dc4835] scale-110" : "text-[#5a6472]/80 group-hover:text-[#222d32]"}`}>
                                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                            </div>
                            <span className={`relative z-10 text-[9px] font-bold uppercase tracking-wider transition-all truncate ${isActive ? "text-[#dc4835]" : "text-[#5a6472] group-hover:text-[#222d32]"}`}>
                                {item.label}
                            </span>
                        </Link>
                    );
                })}

                <button
                    onClick={() => void signOut({ callbackUrl: '/' })}
                    className="flex flex-col items-center justify-center py-1.5 px-2 gap-0.5 text-[#5a6472]/80 hover:text-[#dc4835] transition-all active:scale-90"
                    title="Sign out"
                >
                    <div className="p-1.5 rounded-xl">
                        <LogOut className="w-5 h-5" strokeWidth={2} />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider truncate">Out</span>
                </button>
            </div>
        </nav>
    );
}
