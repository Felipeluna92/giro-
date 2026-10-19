import { requireRiderUser } from '../../lib/auth';
import MerchantDashboard from './merchant-dashboard';
export const dynamic='force-dynamic';
export default async function MerchantPage(){await requireRiderUser();return <MerchantDashboard/>;}
