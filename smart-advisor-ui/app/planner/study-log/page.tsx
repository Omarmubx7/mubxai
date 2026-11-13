import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session-server";
import PlannerStudyLogClient from "@/components/PlannerStudyLogClient";

export const metadata: Metadata = {
    title: "Study Log — Semester Planner",
    description: "Log and track your study sessions, build consistency streaks, and earn XP with MUBXAI's gamified study tracker.",
    alternates: {
        canonical: "https://ai.mubx.dev/planner/study-log",
    },
    robots: { index: false, follow: true },
};
export default async function PlannerStudyLogPage() {
    const session = await getSession();
    if (!session) {
        redirect("/");
    }

    return <PlannerStudyLogClient />;
}
