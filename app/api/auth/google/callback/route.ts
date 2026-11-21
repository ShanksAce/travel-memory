import { env } from 'cloudflare:workers';
import { googleEnabled, publicOrigin } from '../../../../../lib/auth-config';
import { createSession, sessionCookie, signInWithGoogle } from '../../../../../lib/auth';

export async function GET(request:Request) {
    const origin=publicOrigin();
    const url=new URL(request.url);
    if (!origin || !googleEnabled() || url.origin!==origin) return new Response(null,{status:503});
    const headers=new Headers({Location:origin+'/signin?google_error=1','Cache-Control':'no-store'});
    headers.append('Set-Cookie','travel_google_flow=; Path=/api/auth/google; Max-Age=0; HttpOnly; SameSite=Lax'+(origin.startsWith('https:')?'; Secure':''));
    const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)travel_google_flow=([^;]+)/)?.[1];
    const [state,verifier]=cookie?.split('.') || [];
    const code=url.searchParams.get('code');
    if (!state || !verifier || !code || state!==url.searchParams.get('state')) return new Response(null,{status:302,headers});
    try {
        const token=await fetch('https://oauth2.googleapis.com/token',{
            method:'POST',signal:AbortSignal.timeout(8000),body:new URLSearchParams({
                code,client_id:env.GOOGLE_CLIENT_ID!,client_secret:env.GOOGLE_CLIENT_SECRET!,
                grant_type:'authorization_code',redirect_uri:origin+'/api/auth/google/callback',code_verifier:verifier,
            }),
        });
        if (!token.ok) return new Response(null,{status:302,headers});
        const {access_token}=await token.json() as {access_token?:string};
        if (!access_token) return new Response(null,{status:302,headers});
        const response=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:'Bearer '+access_token},signal:AbortSignal.timeout(8000)});
        if (!response.ok) return new Response(null,{status:302,headers});
        const profile=await response.json() as {sub?:string;email?:string;email_verified?:boolean};
        const owner = await signInWithGoogle(profile);
        if (owner) {
            headers.append('Set-Cookie',sessionCookie(await createSession(owner.id),request));
            headers.set('Location',origin+'/');
        }
    } catch { /* Redirect to the generic sign-in error. */ }
    return new Response(null,{status:302,headers});
}
