import {notFound,redirect} from 'next/navigation';
import {getRiderUser} from '../../../lib/auth';
import {stripeRpc,stripeConfigured} from '../../../lib/stripe-server';
import AdminBilling from '../settings';
export const dynamic='force-dynamic';
export default async function Admin(){
 const user=await getRiderUser();if(!user)redirect('/entrar');if(!user.access.isAdmin)notFound();
 let databaseReady=false,lastEventAt:string|null=null;
 try{const status=await stripeRpc<{lastEventAt:string|null}>('stripe_billing_status');databaseReady=true;lastEventAt=status.lastEventAt;}catch{console.error('giro_stripe_database_unavailable');}
 return <AdminBilling ready={stripeConfigured()&&databaseReady} keyConfigured={!!process.env.STRIPE_SECRET_KEY} webhookConfigured={!!process.env.STRIPE_WEBHOOK_SECRET} databaseReady={databaseReady} lastEventAt={lastEventAt}/>;
}
