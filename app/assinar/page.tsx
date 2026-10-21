import {redirect} from 'next/navigation';
import {getRiderUser} from '../../lib/auth';
import {getPublicPlans} from '../../lib/billing-server';
import {stripeRpc} from '../../lib/stripe-server';
import Subscription from './subscription';
export const dynamic='force-dynamic';
export default async function Assinar({searchParams}:{searchParams:Promise<{plano?:string;pagamento?:string}>}){
 const user=await getRiderUser();if(!user)redirect('/entrar');if(user.access.isAdmin)redirect('/admin');
 const query=await searchParams,access=user.access;let hasCustomer=false;
 try{hasCustomer=!!await stripeRpc('stripe_customer',{p_user:user.userId});}catch{console.error('giro_billing_summary_unavailable');}
 if(query.plano==='combo'&&access.combo)redirect('/comerciante/equipe');
 return <Subscription plans={await getPublicPlans()} access={access} email={user.email} hasCustomer={hasCustomer} payment={query.pagamento} selected={query.plano==='combo'?'combo':query.plano==='merchant'?'merchant':'rider'}/>;
}
