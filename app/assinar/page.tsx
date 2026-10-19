import {redirect} from 'next/navigation';
import {getRiderUser} from '../../lib/auth';
import {billingClient,getPublicPlans} from '../../lib/billing-server';
import {createClient} from '../../lib/supabase/server';
import {accountAccess} from '../../lib/access';
import Subscription from './subscription';
export const dynamic='force-dynamic';
export default async function Assinar({searchParams}:{searchParams:Promise<{plano?:string}>}){
 const user=await getRiderUser();if(!user)redirect('/entrar');if(user.access.isAdmin)redirect('/admin');
 const query=await searchParams;let access=user.access;
 try{const {error}=await billingClient().rpc('claim_giro_purchases',{p_user:user.userId});if(!error){const result=await (await createClient()).rpc('get_account_access');if(!result.error)access=accountAccess(result.data);}}catch{console.error('giro_purchase_sync_unavailable');}
 return <Subscription plans={await getPublicPlans()} access={access} email={user.email} selected={query.plano==='merchant'?'merchant':'rider'}/>;
}
