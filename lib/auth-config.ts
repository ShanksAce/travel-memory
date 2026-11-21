import { env } from 'cloudflare:workers';

export function publicOrigin() {
    if (!env.APP_ORIGIN) return null;
    try {
        const url = new URL(env.APP_ORIGIN);
        if ((url.protocol==='https:' || ['localhost','127.0.0.1'].includes(url.hostname)) && url.origin===env.APP_ORIGIN) return url.origin;
    } catch { /* Configuration is unavailable. */ }
    return null;
}

export function googleEnabled() {
    return Boolean(publicOrigin() && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
