import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createAdminLog, createUser, getUserByStudentId } from "@/lib/database";
import { setSessionOnResponse } from "@/lib/session-server";
import { authCredentialsSchema } from "@/lib/schemas/api";
import { validationErrorResponse } from "@/lib/validation";
import { authRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isSecure(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol;
  return proto.replace(":", "") === "https";
}

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 login attempts per minute per IP
    const rateLimit = authRateLimit(req);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          },
        }
      );
    }

    const body = await req.json();
    const validation = authCredentialsSchema.safeParse(body);
    if (!validation.success) {
      return validationErrorResponse(validation.error.issues);
    }
    const { student_id, password } = validation.data;
    const isClaiming =
      validation.data.is_claiming === true || validation.data.is_claiming === "true";

    const existing = await getUserByStudentId(student_id);

    if (existing?.role === "banned") {
      return NextResponse.json({ error: "Account is banned" }, { status: 403 });
    }

    let user;

    if (isClaiming) {
      if (existing) {
        return NextResponse.json(
          { error: "An account with this university ID already exists" },
          { status: 409 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 10);
      user = await createUser({ student_id, password_hash: passwordHash });
    } else {
      if (!existing?.password_hash) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      const isValid = await bcrypt.compare(password, existing.password_hash);
      if (!isValid) {
        return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }

      user = existing;
    }

    if (!user?.id) {
      return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
    }

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, student_id: user.student_id },
    });

    await setSessionOnResponse(
      response,
      {
        id: String(user.id),
        db_id: user.id,
        student_id: user.student_id,
        email: user.email,
        name: user.name ?? user.student_id,
        image: user.image,
        provider: "credentials",
        role: user.role ?? "student",
      },
      isSecure(req)
    );

    createAdminLog({
      type: isClaiming ? "register" : "login",
      message: isClaiming
        ? `Student ${user.student_id} claimed their account`
        : `Student ${user.student_id} logged in via credentials`,
      details: { student_id: user.student_id, email: user.email, name: user.name },
      event_kind: isClaiming ? "register" : "login",
      target_id: user.student_id || String(user.id),
    }).catch(() => {});

    return response;
  } catch (e) {
    console.error("Signin error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
