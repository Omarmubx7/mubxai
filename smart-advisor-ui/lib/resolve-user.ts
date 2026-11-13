import { prisma } from "@/lib/prisma";
import type { AppSession as Session } from "@/lib/session";

/**
 * Centrally resolves the authenticated user from the session.
 * Uses the database ID if available, otherwise falls back to email or student_id.
 */
export async function resolveAuthenticatedUser(session: Session | null) {
    if (!session || !session.user) return null;

    // 1. Primary lookup by database ID (fastest, most reliable)
    if (session.user.db_id) {
        const user = await prisma.user.findUnique({ where: { id: Number(session.user.db_id) } });
        if (user) return user;
    }

    // 2. Fallback lookup by email or student_id
    const email = session.user.email;
    const studentId = session.user.student_id || session.user.name || email;

    const user = await prisma.user.findFirst({
        where: { 
            OR: [
                { email: email || undefined }, 
                { student_id: studentId || undefined }
            ] 
        }
    });

    return user;
}
