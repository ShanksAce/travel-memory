'use client';

import { useEffect, useState, type FormEvent } from 'react';
import PasswordField from '../password-field';

export default function Recover() {
    const [token,setToken]=useState(''), [busy,setBusy]=useState(false), [message,setMessage]=useState(''), [error,setError]=useState('');
    useEffect(()=>{setToken(window.location.hash.slice(1));},[]);
    async function submit(event:FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form=new FormData(event.currentTarget);
        const password=String(form.get('password')||'');
        setMessage('');setError('');
        if(token && password!==form.get('confirm')) {setError('兩次新密碼不一致。');return;}
        setBusy(true);
        try {
            const response=await fetch('/api/auth/recovery',{method:'POST',headers:{'Content-Type':'application/json'},
                body:JSON.stringify(token?{action:'reset',token,password}:{action:'request',email:form.get('email')})});
            const body=await response.json() as {error?:string};
            if(!response.ok) throw Error(body.error || '目前無法處理，請稍後再試。');
            if(token) window.location.replace('/signin?reset=1');
            else setMessage('若此電子郵件已註冊，你將收到重設連結。');
        } catch(e) {setError((e as Error).message);}
        finally {setBusy(false);}
    }
    return <main className="settings-page recovery-page"><a className="text-button" href="/signin">← 返回登入</a><h1>重設密碼</h1>
        <form className="panel" onSubmit={submit}>
            {token ? <><PasswordField className="field" label="新密碼" name="password" required minLength={10} maxLength={128} autoComplete="new-password"/><PasswordField className="field" label="確認新密碼" name="confirm" required minLength={10} maxLength={128} autoComplete="new-password"/></> :
                <label className="field">電子郵件<input name="email" type="email" maxLength={254} required autoComplete="email"/></label>}
            {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
            <button className="button primary" disabled={busy}>{token?'更新密碼':'寄送重設連結'}</button>
        </form>
    </main>;
}
