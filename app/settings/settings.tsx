'use client';
import PasswordField from '../password-field';
import { useState, useEffect, type FormEvent } from 'react';
import Avatar from '../avatar';
import {exportAccountBackup, restoreAccountBackup} from '../../lib/backup-client';
import {maxBackupBytes} from '../../lib/backup';
import {exportGuest} from '../../lib/guest';
import { themes } from '../../lib/appearance';
export default function Settings({ name, email, guest = false, initialTheme, initialMotion }: {
    name: string;
    email: string;
    guest?: boolean;
    initialTheme: typeof themes[number]['id'];
    initialMotion: boolean;
}) {
    const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState(''), [version, setVersion] = useState(0), [hasAvatar, setHasAvatar] = useState(true);
    const [section, setSection] = useState('appearance'), [theme, setTheme] = useState(initialTheme), [motion, setMotion] = useState(initialMotion), [displayName, setDisplayName] = useState(name);
    function preference(key: string, value: string) { document.documentElement.dataset[key] = value; document.cookie = 'travel_' + key + '=' + value + '; Path=/; Max-Age=31536000; SameSite=Lax'; }
    async function exportRecords() {
        setBusy(true); setError('');
        try { const r = guest ? null : await fetch('/api/data'); if (r && !r.ok) throw Error('無法匯出，請重新登入後再試。'); const data = guest ? await exportGuest() : await r!.json(); const url = URL.createObjectURL(new Blob([JSON.stringify({exported_at:new Date().toISOString(),note:'包含文字紀錄與照片索引，照片原始檔需另外下載。',...data as object},null,2)],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download='travel-memory-'+new Date().toISOString().slice(0,10)+'.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); setMessage('已匯出文字紀錄與照片索引。'); }
        catch(e) { setError((e as Error).message); } finally {setBusy(false);}
    }
    const [backupTrip,setBackupTrip]=useState('');
    const [backupTrips,setBackupTrips]=useState<{id:string;title:string}[]>([]);
    useEffect(()=>{
        if(guest || section!=='data') return;
        const controller=new AbortController();
        void fetch('/api/data',{signal:controller.signal}).then(r=>r.ok?r.json():null).then(value=>{
            const data=value as {trips?:{id:string;title:string}[]}|null;
            if(data?.trips) setBackupTrips(data.trips);
        }).catch(()=>{});
        return ()=>controller.abort();
    },[guest,section]);
    async function fullBackup() {
        setBusy(true); setError(''); setMessage('');
        try {
            const blob=new Blob([JSON.stringify(await exportAccountBackup(backupTrip || undefined))],{type:'application/json'});
            if(blob.size>maxBackupBytes) throw Error('單份備份上限 32 MB。');
            const url=URL.createObjectURL(blob);
            const link=document.createElement('a');
            link.href=url;link.download='travel-memory-backup.json';link.click();
            setTimeout(()=>URL.revokeObjectURL(url),1000);
            setMessage('已下載完整旅行備份。');
        } catch(error) {setError((error as Error).message);}
        finally {setBusy(false);}
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
    return <main className="settings-page"><a className="text-button" href="/">← 返回行旅錄</a><h1>設定</h1><nav className="settings-nav" aria-label="設定分類">{[['appearance','外觀與動效'],['profile','個人資料'],['security','帳號安全'],['data','資料管理']].filter(([id])=>!guest || id==='appearance'||id==='data').map(([id,label]) => <button key={id} disabled={busy} className={section===id?'button primary':'button'} aria-pressed={section===id} onClick={()=>{setSection(id);setError('');setMessage('');}}>{label}</button>)}</nav>
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
        <form hidden={section!=='security'} className="panel" onSubmit={e => void save(e, 'password')}><p>登入帳號：{email}</p><h2>修改密碼</h2><p className="helper">更新後所有裝置都需要重新登入。</p><PasswordField className="field" label="目前密碼" name="current" required maxLength={128} autoComplete="current-password"/><PasswordField className="field" label="新密碼（10–128 個字元）" name="password" required minLength={10} maxLength={128} autoComplete="new-password"/><PasswordField className="field" label="再次輸入新密碼" name="confirm" required minLength={10} maxLength={128} autoComplete="new-password"/><button className="button primary" disabled={busy}>更新密碼</button></form>
<section hidden={section!=='data'} className="panel"><h2>資料管理</h2><p>匯出旅行文字紀錄與照片索引，保存一份備份。</p><p className="helper">{guest ? '訪客備份包含照片。登入後可從首頁匯入帳號。' : '文字匯出不包含照片。完整旅行備份含原始照片，每份上限 32 MB。'}</p><button className="button" disabled={busy} onClick={exportRecords}>匯出旅行紀錄</button>{!guest&&<>
    <label className="field">備份範圍<select value={backupTrip} onChange={event=>setBackupTrip(event.target.value)} disabled={busy}><option value="">所有旅行</option>{backupTrips.map(trip=><option key={trip.id} value={trip.id}>{trip.title}</option>)}</select></label>
    <button className="button primary" disabled={busy} onClick={fullBackup}>下載完整旅行備份</button>
    <form onSubmit={async event=>{
        event.preventDefault();
        const form=event.currentTarget, file=new FormData(form).get('backup');
        if(!(file instanceof File)||!file.size)return;
        setBusy(true);setMessage('');setError('');
        try {const result=await restoreAccountBackup(file);setMessage(result.duplicate?'這份備份已還原過。':'已新增 '+result.trips+' 趟旅行。');form.reset();}
        catch(error){setError((error as Error).message);}
        finally{setBusy(false);}
    }}><label className="field">選擇旅行備份 JSON<input name="backup" type="file" accept=".json,application/json" required disabled={busy}/></label>
    <p className="helper">還原內容會新增為旅行副本。</p><button className="button" disabled={busy}>還原備份</button></form>
    </>}</section>
    </main>;
}

