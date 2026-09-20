import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';

export type AppUser = {
    userId: string;
    displayName: string;
    email: string;
    fullName: string | null;
};

type UserRow = {
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    password_salt: string;
    password_iterations: number;
};

type AttemptRow = {
    attempts: number;
    window_started_at: string;
};

const SESSION_COOKIE = 'travel_memory_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 310_000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;

function database() {
    if (!env.DB) throw new Error('Database binding DB is unavailable.');
    return env.DB;
}

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function bytesToBase64Url(bytes: Uint8Array) {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string) {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(base64);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function sha256(value: string) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return bytesToBase64Url(new Uint8Array(digest));
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(password),
        'PBKDF2',
        false,
        ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
        key,
        256,
    );
    return bytesToBase64Url(new Uint8Array(bits));
}

function timingSafeEqual(a: string, b: string) {
    const left = base64UrlToBytes(a);
    const right = base64UrlToBytes(b);
    let mismatch = left.length ^ right.length;
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i++) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
    return mismatch === 0;
}

export async function getCurrentUser(): Promise<AppUser | null> {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const tokenHash = await sha256(token);
    const now = new Date().toISOString();
    const row = await database().prepare(
        `SELECT u.id,u.email,u.display_name
         FROM sessions s JOIN users u ON u.id=s.user_id
         WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`,
    ).bind(tokenHash, now).first<{ id: string; email: string; display_name: string }>();
    if (!row) return null;
    return {
        userId: row.id,
        displayName: row.display_name,
        email: row.email,
        fullName: row.display_name,
    };
}

export async function registerUser(name: string, email: string, password: string) {
    const displayName = name.trim();
    const normalizedEmail = normalizeEmail(email);
    if (displayName.length < 1 || displayName.length > 80) throw new Error('名稱需為 1 到 80 個字元。');
    if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('請輸入有效的電子郵件。');
    if (password.length < 10 || password.length > 128) throw new Error('密碼至少 10 個字元，最多 128 個字元。');

    const existing = await database().prepare('SELECT id FROM users WHERE email=? LIMIT 1').bind(normalizedEmail).first();
    if (existing) throw new Error('這個電子郵件已註冊，請直接登入。');

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await database().prepare(
        'INSERT INTO users(id,email,display_name,password_hash,password_salt,password_iterations,created_at) VALUES(?,?,?,?,?,?,?)',
    ).bind(id, normalizedEmail, displayName, passwordHash, bytesToBase64Url(salt), PASSWORD_ITERATIONS, createdAt).run();
    return { userId: id, displayName, email: normalizedEmail, fullName: displayName } satisfies AppUser;
}

export async function authenticateUser(email: string, password: string, request: Request) {
    const normalizedEmail = normalizeEmail(email);
    await assertLoginAllowed(normalizedEmail, request);
    const row = await database().prepare(
        'SELECT id,email,display_name,password_hash,password_salt,password_iterations FROM users WHERE email=? LIMIT 1',
    ).bind(normalizedEmail).first<UserRow>();

    let valid = false;
    if (row) {
        const candidate = await derivePassword(password, base64UrlToBytes(row.password_salt), row.password_iterations);
        valid = timingSafeEqual(candidate, row.password_hash);
    } else {
        const fakeSalt = new Uint8Array(16);
        await derivePassword(password || 'invalid-password', fakeSalt, PASSWORD_ITERATIONS);
    }

    if (!row || !valid) {
        await recordFailedLogin(normalizedEmail, request);
        return null;
    }
    await clearFailedLogins(normalizedEmail, request);
    return { userId: row.id, displayName: row.display_name, email: row.email, fullName: row.display_name } satisfies AppUser;
}

export async function createSession(userId: string) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const token = bytesToBase64Url(bytes);
    const tokenHash = await sha256(token);
    const now = Date.now();
    const createdAt = new Date(now).toISOString();
    const expiresAt = new Date(now + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    await database().prepare('DELETE FROM sessions WHERE expires_at<=?').bind(createdAt).run();
    await database().prepare(
        'INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)',
    ).bind(tokenHash, userId, expiresAt, createdAt).run();
    return token;
}

export async function deleteSessionFromRequest(request: Request) {
    const token = readCookie(request.headers.get('cookie') || '', SESSION_COOKIE);
    if (!token) return;
    await database().prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
}

export function sessionCookie(token: string, request: Request) {
    const secure = new URL(request.url).protocol === 'https:';
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure ? '; Secure' : ''}`;
}

export function expiredSessionCookie(request: Request) {
    const secure = new URL(request.url).protocol === 'https:';
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

function readCookie(header: string, name: string) {
    for (const part of header.split(';')) {
        const [key, ...rest] = part.trim().split('=');
        if (key === name) return rest.join('=');
    }
    return null;
}

async function attemptKey(email: string, request: Request) {
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    return sha256(`${email}\n${ip}`);
}

async function assertLoginAllowed(email: string, request: Request) {
    const key = await attemptKey(email, request);
    const row = await database().prepare('SELECT attempts,window_started_at FROM auth_attempts WHERE attempt_key=?').bind(key).first<AttemptRow>();
    if (!row) return;
    const started = Date.parse(row.window_started_at);
    if (!Number.isFinite(started) || Date.now() - started >= LOGIN_WINDOW_MS) {
        await database().prepare('DELETE FROM auth_attempts WHERE attempt_key=?').bind(key).run();
        return;
    }
    if (row.attempts >= LOGIN_LIMIT) throw new Error('登入嘗試過多，請 15 分鐘後再試。');
}

async function recordFailedLogin(email: string, request: Request) {
    const key = await attemptKey(email, request);
    const now = new Date().toISOString();
    const row = await database().prepare('SELECT attempts,window_started_at FROM auth_attempts WHERE attempt_key=?').bind(key).first<AttemptRow>();
    const started = row ? Date.parse(row.window_started_at) : NaN;
    if (!row || !Number.isFinite(started) || Date.now() - started >= LOGIN_WINDOW_MS) {
        await database().prepare(
            'INSERT INTO auth_attempts(attempt_key,attempts,window_started_at,last_attempt_at) VALUES(?,?,?,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,last_attempt_at=excluded.last_attempt_at',
        ).bind(key, 1, now, now).run();
        return;
    }
    await database().prepare('UPDATE auth_attempts SET attempts=attempts+1,last_attempt_at=? WHERE attempt_key=?').bind(now, key).run();
}

async function clearFailedLogins(email: string, request: Request) {
    const key = await attemptKey(email, request);
    await database().prepare('DELETE FROM auth_attempts WHERE attempt_key=?').bind(key).run();
}
