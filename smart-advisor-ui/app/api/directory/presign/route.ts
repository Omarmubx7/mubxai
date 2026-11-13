import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client, R2_BUCKET_NAME, R2_PUBLIC_URL } from "@/lib/r2";
import { checkRateLimit } from "@/lib/rate-limit";
import { getExtension, safeContentType } from "@/lib/resource-uploads";
import { getSiteSettings } from "@/lib/settings-server";
import { maxFileSizeBytes } from "@/lib/site-settings";

function generateKey(filename: string): string {
    const ext = getExtension(filename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `resources/${timestamp}-${random}.${ext}`;
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ error: "You must be signed in to upload files." }, { status: 401 });
    }

    const rateLimit = checkRateLimit(req, { maxRequests: 60, windowMs: 60_000 });
    if (!rateLimit.allowed) {
        return NextResponse.json({ error: "Too many upload requests. Please slow down." }, { status: 429 });
    }

    try {
        // Admin-editable upload policy (falls back to safe defaults on any error).
        const settings = await getSiteSettings();

        if (!settings.resources.enabled || !settings.resources.uploadsEnabled) {
            return NextResponse.json(
                { error: "Uploads are currently disabled." },
                { status: 403 }
            );
        }

        const { filename, fileSize } = await req.json();

        if (!filename || typeof filename !== "string") {
            return NextResponse.json({ error: "Missing required field: filename." }, { status: 400 });
        }

        if (filename.length > 255) {
            return NextResponse.json({ error: "Filename is too long. Maximum 255 characters." }, { status: 400 });
        }

        const allowedExtensions = settings.upload.allowedExtensions.map((e) => e.toLowerCase());
        const ext = getExtension(filename);
        if (!allowedExtensions.includes(ext)) {
            return NextResponse.json(
                { error: `Unsupported file type. Allowed: ${settings.upload.allowedExtensions.join(", ")}.` },
                { status: 415 }
            );
        }

        if (typeof fileSize !== "number" || !Number.isFinite(fileSize) || fileSize <= 0) {
            return NextResponse.json({ error: "Missing required field: fileSize." }, { status: 400 });
        }

        const maxBytes = maxFileSizeBytes(settings);
        if (fileSize > maxBytes) {
            return NextResponse.json(
                {
                    error: `File "${filename}" is too large (${(fileSize / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${settings.upload.maxFileSizeMb} MB.`,
                },
                { status: 413 }
            );
        }

        const key = generateKey(filename);
        // Never trust the client's Content-Type — derive a safe one from the extension.
        const contentType = safeContentType(filename);
        const s3 = getR2Client();

        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        return NextResponse.json({ uploadUrl, key, publicUrl, contentType });
    } catch (error) {
        console.error("[directory] Presign error:", error);
        return NextResponse.json(
            { error: "Failed to generate upload URL" },
            { status: 500 }
        );
    }
}
