// Runtime-agnostic base64 / base64url helpers.
//
// `btoa` only accepts binary strings, so text must be UTF-8 encoded first and
// the resulting bytes appended one at a time. Avoid `String.fromCodePoint(...)`
// on random byte arrays: values above 0xFF make `btoa` throw.

function bytesToBinaryString(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return binary;
}

function binaryStringToBytes(binary: string): Uint8Array {
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

/** UTF-8 text -> base64url (no padding). */
export function encodeBase64UrlText(text: string): string {
    return btoa(bytesToBinaryString(new TextEncoder().encode(text)))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
}

/** base64url (with or without padding) -> UTF-8 text. Throws on invalid input. */
export function decodeBase64UrlText(value: string): string {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return new TextDecoder().decode(binaryStringToBytes(atob(padded)));
}

/** Random, URL-safe token from `bytes` cryptographically random bytes. */
export function randomUrlSafeToken(bytes = 32): string {
    const buffer = new Uint8Array(bytes);
    crypto.getRandomValues(buffer);
    return btoa(bytesToBinaryString(buffer))
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replace(/=+$/, "");
}
