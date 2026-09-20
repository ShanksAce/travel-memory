import { deleteSessionFromRequest, expiredSessionCookie } from '../../lib/auth';

function safeReturnTo(value: string | null) {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
    try {
        const url = new URL(value, 'https://app.local');
        return url.origin === 'https://app.local' ? `${url.pathname}${url.search}${url.hash}` : '/';
    } catch {
        return '/';
    }
}

export async function GET(request: Request) {
    try {
        await deleteSessionFromRequest(request);
    } catch (error) {
        console.error('Logout cleanup failed', error);
    }
    const url = new URL(request.url);
    const target = new URL(safeReturnTo(url.searchParams.get('return_to')), url.origin);
    return new Response(null, {
        status: 303,
        headers: {
            Location: target.toString(),
            'Set-Cookie': expiredSessionCookie(request),
            'Cache-Control': 'no-store',
        },
    });
}
