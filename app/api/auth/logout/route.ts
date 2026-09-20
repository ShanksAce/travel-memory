import { deleteSessionFromRequest, expiredSessionCookie } from '../../../../lib/auth';
import { checkOrigin } from '../../../../lib/server';

export async function POST(request: Request) {
    try {
        checkOrigin(request);
        await deleteSessionFromRequest(request);
    } catch (error) {
        console.error('Logout cleanup failed', error);
    }
    return Response.json({ ok: true }, {
        headers: { 'Set-Cookie': expiredSessionCookie(request), 'Cache-Control': 'no-store' },
    });
}
