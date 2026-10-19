import { requireRiderUser } from '../../lib/auth';
import MerchantDashboard from './merchant-dashboard';
export const dynamic='force-dynamic';
export default async function MerchantPage(){const user=await requireRiderUser('merchant');return <MerchantDashboard isAdmin={user.access.isAdmin}/>;}
