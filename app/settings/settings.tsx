'use client';
import { useState, type FormEvent } from 'react';
import Avatar from '../avatar';
export default function Settings({ name, email }: { name: string; email: string }) {
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0), [hasAvatar, setHasAvatar] = useState(true);
    async function send(url: string, init: RequestInit, success: string) {
        setBusy(true); setError(''); setMessage('');
        try { const response = await fetch(url, init); const result = await response.json() as { error?: string }; if (!response.ok) throw Error(result.error || '操作失敗'); setMessage(success); return true; }
        catch (e) { setError((e as Error).message); return false; }
        finally { setBusy(false); }
    }
    async function save(e: FormEvent<HTMLFormElement>, action: 'name' | 'password') {
        e.preventDefault(); const form = e.currentTarget; const fields = Object.fromEntries(new FormData(form));
        if (action === 'password' && fields.password !== fields.confirm) { setError('兩次新密碼不一致。'); return; }
        const ok = await send('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...fields, action }) }, action === 'name' ? '名稱已更新，返回旅行即可看到。' : '密碼已更新，請重新登入。');
        if (ok && action === 'password') window.location.assign('/signin');
    }
    return <main className="settings-page"><a className="text-button" href="/">← 返回旅行</a><h1>帳號設定</h1><p>{email}</p>
        {error && <div className="error-banner" role="alert">{error}</div>}{message && <p role="status">{message}</p>}
        <section className="panel"><h2>頭貼</h2><Avatar name={name} version={version} removed={!hasAvatar} large/>
            <label className="field">上傳照片（JPEG、PNG、WebP，上限 2 MB）<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
                const input = e.currentTarget; const file = input.files?.[0]; if (!file) return;
                if (file.size > 2 * 1024 * 1024) { setError('頭貼上限 2 MB。'); input.value = ''; return; }
                const form = new FormData(); form.set('file', file);
                if (await send('/api/account/avatar', { method: 'POST', body: form }, '頭貼已更新。')) { setHasAvatar(true); setVersion(v => v + 1); }
                input.value = '';
            }}/></label><button className="text-button" disabled={busy || !hasAvatar} onClick={async () => { if (await send('/api/account/avatar', { method: 'DELETE' }, '已恢復預設頭貼。')) setHasAvatar(false); }}>移除頭貼</button></section>
        <form className="panel" onSubmit={e => void save(e, 'name')}><h2>顯示名稱</h2><label className="field">使用者名稱<input name="name" defaultValue={name} required maxLength={80} autoComplete="nickname"/></label><button className="button primary" disabled={busy}>儲存名稱</button></form>
        <form className="panel" onSubmit={e => void save(e, 'password')}><h2>修改密碼</h2><p className="helper">更新後所有裝置都需要重新登入。</p><label className="field">目前密碼<input name="current" type="password" required maxLength={128} autoComplete="current-password"/></label><label className="field">新密碼（10–128 個字元）<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label><label className="field">再次輸入新密碼<input name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label><button className="button primary" disabled={busy}>更新密碼</button></form>
    </main>;
}

