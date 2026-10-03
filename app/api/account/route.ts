import { z } from 'zod';
import { changePassword, expiredSessionCookie } from '../../../lib/auth';
import { identity, checkOrigin, db, failure, ApiError } from '../../../lib/server';
export async function POST(req: Request) {
    try {
        checkOrigin(req);
        const user = await identity();
        if (Number(req.headers.get('content-length')) > 10000) throw new ApiError(413, '資料過大。');
        const input = z.discriminatedUnion('action', [
            z.object({ action: z.literal('name'), name: z.string().trim().min(1).max(80) }),
            z.object({ action: z.literal('password'), current: z.string().min(1).max(128), password: z.string().min(10).max(128) }),
        ]).parse(await req.json());
        if (input.action === 'name') {
            await db().prepare('UPDATE users SET display_name=? WHERE id=?').bind(input.name, user.userId).run();
            return Response.json({ ok: true });
        }
        try { await changePassword(user, input.current, input.password, req); }
        catch (error) {
            const message = error instanceof Error ? error.message : '';
            if (message.includes('15 分鐘')) throw new ApiError(429, message);
            if (message === '目前密碼不正確。') throw new ApiError(400, message);
            throw error;
        }
        return Response.json({ ok: true }, { headers: { 'Set-Cookie': expiredSessionCookie(req) } });
    } catch (error) { return failure(error); }
}
