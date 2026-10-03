'use client';

import { useState, type FormEvent } from 'react';
import { Compass, LoaderCircle } from 'lucide-react';
import styles from './auth-form.module.css';

type Mode = 'login' | 'register';

export default function AuthForm({ returnTo }: { returnTo: string }) {
    const [mode, setMode] = useState<Mode>('login');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        const values = Object.fromEntries(new FormData(event.currentTarget));
        try {
            const response = await fetch(`/api/auth/${mode}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });
            const data = await response.json() as { error?: string };
            if (!response.ok) throw new Error(data.error || '操作失敗，請稍後再試。');
            window.location.assign(returnTo);
        } catch (err) {
            setError(err instanceof Error ? err.message : '操作失敗，請稍後再試。');
            setBusy(false);
        }
    }

    return <main className={styles.page}>
        <section className={styles.card}>
            <a className={styles.brand} href="/"><Compass size={34}/><span>行旅錄<small>記所行，藏所感</small></span></a>
            <div className={styles.copy}>
                <span className={styles.eyebrow}>YOUR JOURNEY, YOUR SPACE</span>
                <h1>{mode === 'login' ? '歡迎回來。' : '建立你的行旅錄。'}</h1>
                <p>{mode === 'login' ? '登入後繼續收藏旅行、照片與心情。' : '帳號資料只用於登入與區分你的私人旅行內容。'}</p>
            </div>
            <div className={styles.tabs} role="tablist" aria-label="登入或註冊">
                <button type="button" className={mode === 'login' ? styles.active : ''} onClick={() => { setMode('login'); setError(''); }}>登入</button>
                <button type="button" className={mode === 'register' ? styles.active : ''} onClick={() => { setMode('register'); setError(''); }}>註冊</button>
            </div>
            <form className={styles.form} onSubmit={submit}>
                {mode === 'register' && <label>顯示名稱<input name="name" autoComplete="name" maxLength={80} required placeholder="例如：旅行者"/></label>}
                <label>電子郵件<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label>
                <label>密碼<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={10} maxLength={128} required placeholder="至少 10 個字元"/></label>
                {error && <div className={styles.error} role="alert">{error}</div>}
                <button className={`button primary ${styles.submit}`} disabled={busy}>{busy && <LoaderCircle size={17} className="spin"/>}{mode === 'login' ? '登入我的手帳' : '建立帳號'}</button>
            </form>
            <p className={styles.note}>登入工作階段使用 HttpOnly Cookie；密碼不會以明文儲存。</p>
        </section>
    </main>;
}
