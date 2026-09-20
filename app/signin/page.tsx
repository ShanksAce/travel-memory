import AuthForm from './auth-form';
import { getCurrentUser } from '../../lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function safeReturnTo(value?: string) {
    if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
    try {
        const url = new URL(value, 'https://app.local');
        return url.origin === 'https://app.local' ? `${url.pathname}${url.search}${url.hash}` : '/';
    } catch {
        return '/';
    }
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
    const params = await searchParams;
    const returnTo = safeReturnTo(params.return_to);
    if (await getCurrentUser()) redirect(returnTo);
    return <AuthForm returnTo={returnTo}/>;
}
