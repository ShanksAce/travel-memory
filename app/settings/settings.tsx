'use client';
import { useState, useEffect, type FormEvent } from 'react';
import Avatar from '../avatar';
import {exportGuest} from '../../lib/guest';
export default function Settings({ name, email, guest = false }: { name: string; email: string; guest?: boolean }) {
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0), [hasAvatar, setHasAvatar] = useState(true);
    const [section, setSection] = useState('appearance'), [theme, setTheme] = useState('journal'), [motion, setMotion] = useState(true), [displayName, setDisplayName] = useState(name);
    const themes = [{id:'journal',name:'暖紙手帳',colors:['#f7f3eb','#23675e','#ce784a']},{id:'forest',name:'山林青綠',colors:['#eef4ed','#32674b','#88a95c']},{id:'ocean',name:'海灣晴藍',colors:['#edf4fa','#28668b','#54a9bb']},{id:'night',name:'暮夜深色',colors:['#172323','#8fc9ae','#e0b07c']}];
    useEffect(() => { setTheme(document.documentElement.dataset.theme || 'journal'); setMotion(document.documentElement.dataset.motion !== 'reduce'); }, []);
    function preference(key: string, value: string) { document.documentElement.dataset[key] = value; document.cookie = 'travel_' + key + '=' + value + '; Path=/; Max-Age=31536000; SameSite=Lax'; }
    async function exportRecords() {
        setBusy(true); setError('');
        try { const r = guest ? null : await fetch('/api/data'); if (r && !r.ok) throw Error('無法匯出，請重新登入後再試。'); const data = guest ? await exportGuest() : await r!.json(); const url = URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),note:'包含文字紀錄與照片索引，照片原始檔需另外下載。',...data as object},null,2)],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download='travel-memory-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); setMessage('已匯出文字紀錄與照片索引。'); }
        catch(e) { setError((e as Error).message); } finally {setBusy(false);}
    }
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
        if (ok && action === 'name') setDisplayName(String(fields.name).trim());
        if (ok && action === 'password') window.location.assign('/signin');
    }
    return <main className="settings-page"><a className="text-button" href="/">← 返回旅行</a><h1>設定</h1><p>讓行旅錄，成為你的旅行空間。</p><nav className="settings-nav" aria-label="設定分類">{[['appearance','外觀與動效'],['profile','個人資料'],['security','帳號安全'],['data','資料管理']].filter(([id])=>!guest || id==='appearance'||id==='data').map(([id,label]) => <button key={id} disabled={busy} className={section===id?'button primary':'button'} aria-pressed={section===id} onClick={()=>{setSection(id);setError('');setMessage('');}}>{label}</button>)}</nav>
        {error && <div className="error-banner" role="alert">{error}</div>}{message && <p role="status">{message}</p>}
        <section hidden={section!=='appearance'} className="panel"><h2>外觀主題</h2><p className="helper">點選立即套用，偏好會保存在這個瀏覽器。</p><div className="theme-grid">{themes.map(t=><button key={t.id} className={'theme-choice'+(theme===t.id?' selected':'')} aria-pressed={theme===t.id} onClick={()=>{setTheme(t.id);preference('theme',t.id);}}><span className="theme-swatches">{t.colors.map(c=><span key={c} style={{background:c}}/>)}</span><strong>{t.name}</strong><small>{theme===t.id?'✓ 使用中':'套用主題'}</small></button>)}</div><label className="settings-toggle"><span>介面動畫<small>按鈕回彈、視窗與選項切換動畫</small></span><input type="checkbox" checked={motion} onChange={e=>{setMotion(e.target.checked);preference('motion',e.target.checked?'full':'reduce');}}/></label></section>
        <section hidden={section!=='profile'} className="panel"><h2>頭貼</h2><Avatar name={displayName} version={version} removed={!hasAvatar} large/>
            <label className="field">上傳照片（JPEG、PNG、WebP，上限 2 MB）<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e => {
                const input = e.currentTarget; const file = input.files?.[0]; if (!file) return;
                if (file.size > 2 * 1024 * 1024) { setError('頭貼上限 2 MB。'); input.value = ''; return; }
                const form = new FormData(); form.set('file', file);
                if (await send('/api/account/avatar', { method: 'POST', body: form }, '頭貼已更新。')) { setHasAvatar(true); setVersion(v => v + 1); }
                input.value = '';
            }}/></label><button className="text-button" disabled={busy || !hasAvatar} onClick={async () => { if (await send('/api/account/avatar', { method: 'DELETE' }, '已恢復預設頭貼。')) setHasAvatar(false); }}>移除頭貼</button></section>
        <form hidden={section!=='profile'} className="panel" onSubmit={e => void save(e, 'name')}><h2>顯示名稱</h2><label className="field">使用者名稱<input name="name" defaultValue={name} required maxLength={80} autoComplete="nickname"/></label><button className="button primary" disabled={busy}>儲存名稱</button></form>
        <form hidden={section!=='security'} className="panel" onSubmit={e => void save(e, 'password')}><p>登入帳號：{email}</p><h2>修改密碼</h2><p className="helper">更新後所有裝置都需要重新登入。</p><label className="field">目前密碼<input name="current" type="password" required maxLength={128} autoComplete="current-password"/></label><label className="field">新密碼（10–128 個字元）<input name="password" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label><label className="field">再次輸入新密碼<input name="confirm" type="password" required minLength={10} maxLength={128} autoComplete="new-password"/></label><button className="button primary" disabled={busy}>更新密碼</button></form>
<section hidden={section!=='data'} className="panel"><h2>資料管理</h2><p>匯出旅行文字紀錄與照片索引，保存一份備份。</p><p className="helper">{guest ? '訪客備份包含照片。登入後可從首頁匯入帳號。' : '匯出檔不包含照片原始檔，目前尚未提供匯入還原。'}</p><button className="button" disabled={busy} onClick={exportRecords}>匯出旅行紀錄</button></section>
    </main>;
}

