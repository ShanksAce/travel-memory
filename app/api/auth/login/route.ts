import { authenticateUser, createSession, sessionCookie } from '../../../../lib/auth';
import { checkOrigin } from '../../../../lib/server';

export async function POST(request: Request) {
    try {
        checkOrigin(request);
        if (Number(request.headers.get('content-length') || 0) > 10_000)
            return Response.json({ error: '登入資料過大。' }, { status: 413 });
        const input = await request.json() as { email?: unknown; password?: unknown };
        const email = typeof input.email === 'string' ? input.email : '';
        const password = typeof input.password === 'string' ? input.password : '';
        if (!email || !password)
            return Response.json({ error: '請輸入電子郵件與密碼。' }, { status: 400 });
        const user = await authenticateUser(email, password, request);
        if (!user)
            return Response.json({ error: '電子郵件或密碼不正確。' }, { status: 401 });
        const token = await createSession(user.userId);
        return Response.json({ ok: true, user: { name: user.displayName, email: user.email } }, {
            headers: { 'Set-Cookie': sessionCookie(token, request), 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '登入失敗，請稍後再試。';
        const status = message.includes('15 分鐘') ? 429 : 400;
        return Response.json({ error: message }, { status });
    }
}
