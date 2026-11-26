import { cookies } from 'next/headers';
import { getCurrentUser } from '../../lib/auth';
import { selectedTheme } from '../../lib/appearance';
import Settings from './settings';
export const dynamic = 'force-dynamic';
export default async function Page() {
    const [user, preferences] = await Promise.all([getCurrentUser(), cookies()]);
    return <Settings
        name={user?.displayName || '訪客'}
        email={user?.email || ''}
        guest={!user}
        initialTheme={selectedTheme(preferences.get('travel_theme')?.value)}
        initialMotion={preferences.get('travel_motion')?.value !== 'reduce'}
    />;
}
