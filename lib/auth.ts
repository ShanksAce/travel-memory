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
const PASSWORD_ITERATIONS = 100_000;
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
    const saltBytes = new Uint8Array(salt.byteLength);
    saltBytes.set(salt);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes.buffer, iterations },
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

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const passwordHash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const created = await database().prepare(
        `INSERT INTO users(id,email,display_name,password_hash,password_salt,password_iterations,created_at)
         SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM users) RETURNING id`,
    ).bind(id, normalizedEmail, displayName, passwordHash, bytesToBase64Url(salt), PASSWORD_ITERATIONS, createdAt).first<{ id: string }>();
    if (!created) throw new Error('此網站已完成擁有者設定，請直接登入。');
    return { userId: id, displayName, email: normalizedEmail, fullName: displayName } satisfies AppUser;
}

export async function signInWithGoogle(profile: { sub?: string; email?: string; email_verified?: boolean }) {
    const email = typeof profile.email === 'string' ? normalizeEmail(profile.email) : '';
    // Google is authoritative for verified Gmail addresses.
    if (typeof profile.sub !== 'string' || !profile.sub || profile.email_verified !== true || !/^[^\s@]{1,64}@gmail\.com$/.test(email)) return null;

    const displayName = email.slice(0, email.indexOf('@'));
    const salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    // No password is set during Google registration. Recovery can later replace this random hash.
    const passwordHash = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
    return database().prepare(
        `INSERT INTO users(id,email,display_name,password_hash,password_salt,password_iterations,created_at,google_sub)
         SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM users WHERE email<>?)
         ON CONFLICT(email) DO UPDATE SET google_sub=excluded.google_sub
         WHERE users.google_sub IS NULL OR users.google_sub=excluded.google_sub
         RETURNING id`,
    ).bind(crypto.randomUUID(), email, displayName, passwordHash, salt, PASSWORD_ITERATIONS, new Date().toISOString(), profile.sub, email)
        .first<{ id: string }>();
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

export async function changePassword(user: AppUser, current: string, next: string, request: Request) {
    if (next.length < 10 || next.length > 128) throw new Error('新密碼需為 10 到 128 個字元。');
    if (current.length > 128) throw new Error('目前密碼不正確。');
    const verified = await authenticateUser(user.email, current, request);
    if (!verified || verified.userId !== user.userId) throw new Error('目前密碼不正確。');
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await derivePassword(next, salt, PASSWORD_ITERATIONS);
    await database().batch([
        database().prepare('UPDATE users SET password_hash=?,password_salt=?,password_iterations=? WHERE id=?').bind(hash, bytesToBase64Url(salt), PASSWORD_ITERATIONS, user.userId),
        database().prepare('DELETE FROM sessions WHERE user_id=?').bind(user.userId),
        database().prepare('DELETE FROM password_resets WHERE user_id=?').bind(user.userId),
    ]);
}
export async function reservePasswordReset(email:string) {
    const token=crypto.randomUUID()+crypto.randomUUID();
    const hash=await sha256(token);
    const now=Date.now();
    const row=await database().prepare(
        'INSERT INTO password_resets(user_id,token_hash,expires_at,requested_at) SELECT id,?,?,? FROM users WHERE email=? ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,requested_at=excluded.requested_at WHERE password_resets.requested_at<=? RETURNING user_id',
    ).bind(hash,now+30*60*1000,now,normalizeEmail(email),now-120000).first();
    return row?token:null;
}

export async function consumePasswordReset(token:string,password:string) {
    const digest=await sha256(token);
    const now=Date.now();
    const target=await database().prepare('SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?').bind(digest,now).first<{user_id:string}>();
    if (!target) return false;
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const hash=await derivePassword(password,salt,PASSWORD_ITERATIONS);
    const eligible='SELECT user_id FROM password_resets WHERE token_hash=? AND expires_at>?';
    const time=Date.now();
    const results=await database().batch([
        database().prepare('UPDATE users SET password_hash=?,password_salt=?,password_iterations=? WHERE id IN ('+eligible+')').bind(hash,bytesToBase64Url(salt),PASSWORD_ITERATIONS,digest,time),
        database().prepare('DELETE FROM sessions WHERE user_id IN ('+eligible+')').bind(digest,time),
        database().prepare('DELETE FROM password_resets WHERE token_hash=?').bind(digest),
    ]);
    return results[0].meta.changes===1;
}
