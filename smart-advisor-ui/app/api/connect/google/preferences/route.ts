import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { resolveAuthenticatedUser } from "@/lib/resolve-user";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validationErrorResponse } from "@/lib/validation";

export async function POST(req: NextRequest) {
    const session = await getServerSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await resolveAuthenticatedUser(session);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    try {
        const body = await req.json();
        const schema = z.object({ preferences: z.record(z.unknown()).optional() });
        const validation = schema.safeParse(body);
        if (!validation.success) return validationErrorResponse(validation.error.issues);
        const { preferences } = validation.data;

        await prisma.integrationToken.update({
            where: { user_id_provider: { user_id: user.id, provider: "google_calendar" } },
            data: { metadata: JSON.parse(JSON.stringify(preferences ?? {})) }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Failed to update preferences", e);
        return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
    }
}
