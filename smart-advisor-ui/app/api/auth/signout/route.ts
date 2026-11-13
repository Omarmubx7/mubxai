import { NextResponse, type NextRequest } from "next/server";
import { clearSessionOnResponse } from "@/lib/session-server";

export const dynamic = "force-dynamic";

function isSecure(req: NextRequest): boolean {
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol;
    return proto.replace(":", "") === "https";
}

async function signOut(req: NextRequest) {
    const { origin, searchParams } = new URL(req.url);
    const callbackUrl = searchParams.get("callbackUrl");
    const wantsJson =
        req.method === "POST" &&
        (req.headers.get("accept") ?? "").includes("application/json");

    const response = wantsJson
        ? NextResponse.json({ ok: true })
        : NextResponse.redirect(
            new URL(
                callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
                    ? callbackUrl
                    : "/",
                origin
            )
        );

    clearSessionOnResponse(response, isSecure(req));
    return response;
}

export async function POST(req: NextRequest) {
    return signOut(req);
}

export async function GET(req: NextRequest) {
    return signOut(req);
}
