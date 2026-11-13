// Server-side session verification for Cloudflare Workers
// Used by protected API routes to validate the mubxai_session cookie.

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

async function verifySession(token: string): Promise<{ user: any } | null> {
    try {
        const decoded = Buffer.from(token, "base64url").toString("utf8");
        const dotIdx = decoded.lastIndexOf(".");
        if (dotIdx === -1) return null;

        const payload = decoded.slice(0, dotIdx);
        const sigHex = decoded.slice(dotIdx + 1);

        const encoder = new TextEncoder();
        const keyData = encoder.encode(NEXTAUTH_SECRET);
        const key = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["verify"]
        );

        const sigBytes = new Uint8Array(
            sigHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
        );

        const valid = await crypto.subtle.verify(
            "HMAC",
            key,
            sigBytes,
            encoder.encode(payload)
        );

        if (!valid) return null;

        const data = JSON.parse(payload);
        if (data.expires && Date.now() > data.expires) return null;

        return { user: data.user };
    } catch {
        return null;
    }
}

export { verifySession };
