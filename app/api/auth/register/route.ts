import { createSession, registerUser, sessionCookie } from '../../../../lib/auth';
import { checkOrigin } from '../../../../lib/server';

export async function POST(request: Request) {
    try {
        checkOrigin(request);
        if (Number(request.headers.get('content-length') || 0) > 12_000)
            return Response.json({ error: '註冊資料過大。' }, { status: 413 });
        const input = await request.json() as { name?: unknown; email?: unknown; password?: unknown };
        const name = typeof input.name === 'string' ? input.name : '';
        const email = typeof input.email === 'string' ? input.email : '';
        const password = typeof input.password === 'string' ? input.password : '';
        const user = await registerUser(name, email, password);
        const token = await createSession(user.userId);
        return Response.json({ ok: true, user: { name: user.displayName, email: user.email } }, {
            status: 201,
            headers: { 'Set-Cookie': sessionCookie(token, request), 'Cache-Control': 'no-store' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '註冊失敗，請稍後再試。';
        const status = message.includes('已註冊') || message.includes('擁有者設定') ? 409 : 400;
        return Response.json({ error: message }, { status });
    }
}
