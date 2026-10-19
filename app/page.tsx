import { requireRiderUser } from '../lib/auth';
import Dashboard from './dashboard';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireRiderUser();if((await cookies()).get('giro_portal')?.value==='merchant')redirect('/comerciante');return <Dashboard accountName={user.fullName?.split(' ')[0]||''}/>}
