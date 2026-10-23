import {cookies} from 'next/headers';
import {portalResponse} from '../../../../lib/portal-api';
import {stripeConfigured,stripeRpc} from '../../../../lib/stripe-server';
import {PURCHASE_COOKIE,purchaseVisitor} from '../../../../lib/purchase-server';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const session=new URL(request.url).searchParams.get('session_id'),cookie=(await cookies()).get(PURCHASE_COOKIE)?.value;
 if(!stripeConfigured()||!cookie||!session||!/^cs_[A-Za-z0-9_]{10,250}$/.test(session))return portalResponse({paid:false,emailSent:false});
 try{const status=await stripeRpc('purchase_status',{p_visitor:purchaseVisitor(cookie).hash,p_session:session});return portalResponse(status||{paid:false,emailSent:false});}
 catch{return portalResponse({paid:false,emailSent:false});}
}
