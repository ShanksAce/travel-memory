'use client';
import PasswordField from '../password-field';

import { useState, type FormEvent } from 'react';
import { ArrowRight, Compass, LoaderCircle } from 'lucide-react';
import styles from './auth-form.module.css';

type Mode = 'login' | 'register';

export default function AuthForm({ returnTo, google, notice }: { returnTo: string; google?: boolean; notice?: string }) {
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
            <header className={styles.copy}>
                <a className={styles.brand} href="/" aria-label="行旅錄首頁"><Compass size={22} aria-hidden="true"/>行旅錄</a>
                <h1>{mode === 'login' ? '登入行旅錄' : '建立行旅錄帳號'}</h1>
                <p>{mode === 'login' ? '登入後查看你的私人旅行手帳。' : '建立帳號後，可在其他裝置查看你的旅行。'}</p>
            </header>
            <div className={styles.tabs} role="group" aria-label="登入或註冊">
                <button type="button" aria-pressed={mode === 'login'} className={mode === 'login' ? styles.active : ''} onClick={() => { setMode('login'); setError(''); }}>登入</button>
                <button type="button" aria-pressed={mode === 'register'} className={mode === 'register' ? styles.active : ''} onClick={() => { setMode('register'); setError(''); }}>註冊</button>
            </div>
            <form className={styles.form} onSubmit={submit}>
                {mode === 'register' && <label>顯示名稱<input name="name" autoComplete="name" maxLength={80} required placeholder="例如：旅行者"/></label>}
                <label>電子郵件<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="you@example.com"/></label>
                <PasswordField key={mode} className="password-field" label="密碼" name="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={10} maxLength={128} required placeholder="至少 10 個字元"/>
                {error && <div className={styles.error} role="alert">{error}</div>}
                <button className={`button primary ${styles.submit}`} disabled={busy}>{busy && <LoaderCircle size={17} className="spin"/>}{mode === 'login' ? '登入我的手帳' : '建立帳號'}</button>
            </form>
            <div className={styles.actions}>
                {google && <a className="button" href="/api/auth/google">{mode === 'register' ? '使用 Google 註冊' : '使用 Google 登入／註冊'}</a>}
                <div>
                    <a className="text-button" href="/recover">忘記密碼</a>
                    <a className="text-button" href="/">先以訪客模式使用 <ArrowRight size={15} aria-hidden="true"/></a>
                </div>
            </div>
            {notice && <p className={styles.notice} role="status">{notice}</p>}
        </section>
    </main>;
}
