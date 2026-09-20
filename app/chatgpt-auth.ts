import { env } from "cloudflare:workers";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
export type ChatGPTUser = {
    userId: string;
    displayName: string;
    email: string;
    fullName: string | null;
};
const USER_ID_HEADER = "oai-authenticated-user-id";
const USER_EMAIL_HEADER = "oai-authenticated-user-email";
const USER_FULL_NAME_HEADER = "oai-authenticated-user-full-name";
const USER_FULL_NAME_ENCODING_HEADER = "oai-authenticated-user-full-name-encoding";
const PERCENT_ENCODED_UTF8 = "percent-encoded-utf-8";
const SIGN_IN_PATH = "/signin-with-chatgpt";
const SIGN_OUT_PATH = "/signout-with-chatgpt";
const CALLBACK_PATH = "/callback";
export const SESSION_COOKIE = "travel_memory_session";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
    const requestHeaders = await headers();
    const userId = requestHeaders.get(USER_ID_HEADER);
    const email = requestHeaders.get(USER_EMAIL_HEADER);
    if (userId && email) {
        const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
        const fullName = encodedFullName &&
            requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
            ? safeDecodeURIComponent(encodedFullName)
            : null;
        return {
            userId,
            displayName: fullName ?? email,
            email,
            fullName,
        };
    }
    if (!standaloneAuthConfigured())
        return null;
    const session = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!session || !(await verifyOwnerSession(session)))
        return null;
    const ownerEmail = env.OWNER_EMAIL!;
    const ownerName = env.OWNER_NAME || ownerEmail;
    return {
        userId: env.OWNER_USER_ID || "owner",
        displayName: ownerName,
        email: ownerEmail,
        fullName: ownerName,
    };
}
export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
    const user = await getChatGPTUser();
    if (user)
        return user;
    redirect(chatGPTSignInPath(returnTo));
}
export function chatGPTSignInPath(returnTo: string): string {
    const safeReturnTo = safeRelativeReturnPath(returnTo);
    return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}
export function chatGPTSignOutPath(returnTo = "/"): string {
    const safeReturnTo = safeRelativeReturnPath(returnTo);
    return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function standaloneAuthConfigured(): boolean {
    return Boolean(env.OWNER_EMAIL && env.OWNER_PASSWORD && env.SESSION_SECRET);
}

export async function ownerPasswordMatches(candidate: string): Promise<boolean> {
    if (!env.OWNER_PASSWORD)
        return false;
    const [actual, expected] = await Promise.all([
        sha256(new TextEncoder().encode(candidate)),
        sha256(new TextEncoder().encode(env.OWNER_PASSWORD)),
    ]);
    return constantTimeEqual(actual, expected);
}

export async function createOwnerSession(): Promise<string> {
    if (!env.SESSION_SECRET)
        throw new Error("SESSION_SECRET is not configured");
    const payload = encodeBase64Url(new TextEncoder().encode(JSON.stringify({
        version: 1,
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    })));
    return `${payload}.${await sign(payload, env.SESSION_SECRET)}`;
}

async function verifyOwnerSession(value: string): Promise<boolean> {
    if (!env.SESSION_SECRET)
        return false;
    const [payload, signature, extra] = value.split(".");
    if (!payload || !signature || extra)
        return false;
    const expected = await sign(payload, env.SESSION_SECRET);
    if (!constantTimeEqual(new TextEncoder().encode(signature), new TextEncoder().encode(expected)))
        return false;
    try {
        const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as {
            version?: number;
            expiresAt?: number;
        };
        return parsed.version === 1 && typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now();
    }
    catch {
        return false;
    }
}

async function sign(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    return encodeBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function sha256(value: Uint8Array): Promise<Uint8Array> {
    const bytes = Uint8Array.from(value);
    return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.buffer));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
    if (left.length !== right.length)
        return false;
    let difference = 0;
    for (let index = 0; index < left.length; index += 1)
        difference |= left[index] ^ right[index];
    return difference === 0;
}

function encodeBase64Url(value: Uint8Array): string {
    let binary = "";
    for (const byte of value)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function safeRelativeReturnPath(value: string): string {
    if (!value.startsWith("/") || value.startsWith("//"))
        return "/";
    let url: URL;
    try {
        url = new URL(value, "https://app.local");
    }
    catch {
        return "/";
    }
    if (url.origin !== "https://app.local")
        return "/";
    if (isReservedAuthPath(url.pathname))
        return "/";
    return `${url.pathname}${url.search}${url.hash}`;
}
function isReservedAuthPath(pathname: string): boolean {
    return (pathname === SIGN_IN_PATH ||
        pathname === SIGN_OUT_PATH ||
        pathname === CALLBACK_PATH);
}
function safeDecodeURIComponent(value: string): string | null {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return null;
    }
}
