import { requireRiderUser } from '../lib/auth';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export default async function Home(){const user=await requireRiderUser();return <Dashboard accountName={user.fullName?.split(' ')[0]||''}/>}
