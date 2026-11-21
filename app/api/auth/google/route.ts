import { env } from 'cloudflare:workers';
import { googleEnabled, publicOrigin } from '../../../../lib/auth-config';

export async function GET(request:Request) {
    const origin=publicOrigin();
    if (!origin || !googleEnabled() || new URL(request.url).origin!==origin) return new Response('Google 登入尚未設定。',{status:503});
    const state=crypto.randomUUID();
    const verifier=crypto.randomUUID()+crypto.randomUUID();
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    const challenge=btoa(String.fromCharCode(...digest)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search=new URLSearchParams({
        client_id:env.GOOGLE_CLIENT_ID!, redirect_uri:origin+'/api/auth/google/callback',
        response_type:'code', scope:'openid email', state, code_challenge:challenge, code_challenge_method:'S256', prompt:'select_account',
    }).toString();
    return new Response(null,{status:302,headers:{
        Location:url.toString(),'Cache-Control':'no-store',
        'Set-Cookie':'travel_google_flow='+state+'.'+verifier+'; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600'+(origin.startsWith('https:')?'; Secure':''),
    }});
}
