import {redirect} from 'next/navigation';
import {getRiderUser} from '../../lib/auth';
import {getPublicPlans} from '../../lib/billing-server';
import {stripeRpc,type OwnedStripeCustomer} from '../../lib/stripe-server';
import type {PixAccess} from '../../lib/pix-server';
import Subscription from './subscription';
export const dynamic='force-dynamic';
export default async function Assinar({searchParams}:{searchParams:Promise<{plano?:string;pagamento?:string}>}){
 const user=await getRiderUser();if(!user)redirect('/entrar');if(user.access.isAdmin)redirect('/admin');
 const query=await searchParams,access=user.access;let customers:OwnedStripeCustomer[]=[],pix:PixAccess[]=[];
 try{[customers,pix]=await Promise.all([stripeRpc<OwnedStripeCustomer[]>('stripe_owned_customers',{p_user:user.userId}),stripeRpc<PixAccess[]>('pix_access_summary',{p_user:user.userId})]);}catch{console.error('giro_billing_summary_unavailable');}

 return <Subscription pix={pix} plans={await getPublicPlans()} access={access} email={user.email} hasCustomer={customers.length>0} customers={customers} payment={query.pagamento} selected={query.plano==='combo'?'combo':query.plano==='merchant'?'merchant':'rider'}/>;
}
