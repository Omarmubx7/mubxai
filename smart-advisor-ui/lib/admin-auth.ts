import { getSession } from "@/lib/session-server";
import { prisma } from "@/lib/prisma";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

function secretsMatch(provided: string, expected: string) {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    if (providedBuf.length !== expectedBuf.length) return false;
    return timingSafeEqual(providedBuf, expectedBuf);
}

export async function requireAdmin(request?: NextRequest | Request) {
    const adminSecret = process.env.ADMIN_SECRET?.trim();
    const providedSecret = request?.headers.get("x-admin-secret")?.trim();

    // Keep compatibility with secret-based admin access used by AdminGate.
    if (adminSecret && providedSecret && secretsMatch(providedSecret, adminSecret)) {
        return null;
    }

    const session = await getSession();

    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user.db_id
        ? await prisma.user.findUnique({
            where: { id: session.user.db_id },
            select: { role: true }
        })
        : await prisma.user.findFirst({
            where: {
                OR: [
                    session.user.email ? { email: session.user.email } : undefined,
                    session.user.student_id ? { student_id: session.user.student_id } : undefined,
                ].filter(Boolean) as Array<{ email?: string; student_id?: string }>,
            },
        select: { role: true }
        });

    if (user?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return null; // null means authorized
}
