import TravelApp from './travel-app';
import { getChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home() { const user = await getChatGPTUser(); return <TravelApp user={user ? { name: user.fullName || '旅行者', email: user.email } : null}/>; }
