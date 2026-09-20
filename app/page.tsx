import TravelApp from './travel-app';
import { getCurrentUser } from '../lib/auth';
export const dynamic = 'force-dynamic';
export default async function Home() { const user = await getCurrentUser(); return <TravelApp user={user ? { name: user.fullName || '旅行者', email: user.email } : null}/>; }
