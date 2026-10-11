import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import Settings from './settings';
export const dynamic = 'force-dynamic';
export default async function Page() {
    const user = await getCurrentUser();

    return <Settings name={user?.displayName || "訪客"} email={user?.email || ""} guest={!user}/>;
}
