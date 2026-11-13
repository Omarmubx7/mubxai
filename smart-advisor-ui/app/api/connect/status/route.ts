import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getIntegrationToken } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ notion: false, google_calendar: false, error: "no_session" }, { status: 401 });
    }

    const studentId = session.user.db_id?.toString() || session.user.student_id || session.user.email;
    if (!studentId) {
        return NextResponse.json({ notion: false, google_calendar: false, error: "no_student_id" }, { status: 400 });
    }

    try {
        const [notionToken, googleToken] = await Promise.all([
            getIntegrationToken(studentId, "notion"),
            getIntegrationToken(studentId, "google_calendar")
        ]);

        return NextResponse.json({
            notion: !!notionToken,
            google_calendar: !!googleToken,
            google_account_email: googleToken?.accountEmail || null
        });
    } catch (error) {
        console.error("[Connect Status] Error:", error);
        return NextResponse.json({ notion: false, google_calendar: false, error: "server_error" }, { status: 500 });
    }
}
