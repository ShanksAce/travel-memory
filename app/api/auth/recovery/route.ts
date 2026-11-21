import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { publicOrigin } from '../../../../lib/auth-config';
import { consumePasswordReset, reservePasswordReset, expiredSessionCookie } from '../../../../lib/auth';
import { ApiError, checkOrigin, failure } from '../../../../lib/server';

const input=z.discriminatedUnion('action',[
    z.object({action:z.literal('request'),email:z.string().trim().email().max(254)}),
    z.object({action:z.literal('reset'),token:z.string().regex(/^[a-f0-9-]{72}$/),password:z.string().min(10).max(128)}),
]);
export async function POST(request:Request) {
    try {
        checkOrigin(request);
        const body=await request.text();
        if (body.length>3000) throw new ApiError(413,'資料過大。');
        let payload:unknown;
        try {payload=JSON.parse(body);}catch {throw new ApiError(400,'請檢查輸入資料。');}
        const parsed=input.safeParse(payload);
        if (!parsed.success) throw new ApiError(400,'請檢查電子郵件、重設連結或新密碼。');
        const data=parsed.data;
        const headers=new Headers({'Cache-Control':'no-store'});
        if (data.action==='reset') {
            if (!await consumePasswordReset(data.token,data.password)) throw new ApiError(400,'連結已過期或使用過，請重新申請。');
            headers.append('Set-Cookie',expiredSessionCookie(request));
        } else {
            const origin=publicOrigin();
            if (!origin || !env.RESEND_API_KEY || !env.RECOVERY_FROM_EMAIL) throw new ApiError(503,'密碼重設郵件尚未開通。');
            const email=data.email.toLowerCase();
            const token=await reservePasswordReset(email);
            if (token) {
                const url=origin+'/recover#'+token;
                const mail=await fetch('https://api.resend.com/emails',{
                    method:'POST',signal:AbortSignal.timeout(8000),
                    headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},
                    body:JSON.stringify({from:env.RECOVERY_FROM_EMAIL,to:[email],subject:'行旅錄｜重設密碼',
                        text:'請在 30 分鐘內開啟此連結重設密碼：\n'+url+'\n若你未申請，可以忽略這封信。'}),
                }).catch(()=>null);
                if (!mail?.ok) console.warn('Password reset email delivery failed');
            }
        }
        return Response.json({ok:true},{headers});
    } catch (error) {return failure(error);}
}
