import { requireRiderUser } from '../../lib/auth';
import Dashboard from '../dashboard';
export const dynamic='force-dynamic';
export default async function RiderPage(){const user=await requireRiderUser();return <Dashboard accountName={user.fullName?.split(' ')[0]||''} isAdmin={user.access.isAdmin}/>;}
