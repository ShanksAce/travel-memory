import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import Settings from './settings';
export const dynamic = 'force-dynamic';
export default async function Page() {
    const user = await getCurrentUser();
    if (!user) redirect('/signin');
    return <Settings name={user.displayName} email={user.email}/>;
}
