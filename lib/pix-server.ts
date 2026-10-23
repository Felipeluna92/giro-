import 'server-only';
import type Stripe from 'stripe';
import type {PlanId} from './access';
import {stripeClient,stripeConfigured,stripeRpc} from './stripe-server';
import {stripeObjectId} from './stripe-events';
import {verifiedPixPayment} from './pix-policy';
import {deliverPurchaseAccess} from './purchase-server';
export type PixAccess={plan:PlanId;paidUntil:string};
export async function pixConfiguration():Promise<string|null>{
 if(!stripeConfigured())return null;
 try{
  // Enabled only after the account's live Pix capability is verified by an operator.
  return await stripeRpc<string|null>('pix_configuration');
 }catch{console.error('giro_pix_availability_unavailable');return null;}
}
type PixOrder={id:string;email:string;plan:PlanId;session_id:string;customer_id:string;first_price_cents:number;fulfillment_lease:string;done:boolean};
export async function syncPixPayment(event:Stripe.Event,reference:{session?:string;intent?:string}){
 const order=await stripeRpc<PixOrder|null>('pix_order',{p_session:reference.session??null,p_intent:reference.intent??null});if(!order)return;
 const stripe=stripeClient(),session=await stripe.checkout.sessions.retrieve(order.session_id);
 const intentId=stripeObjectId(session.payment_intent);if(!intentId)return;
 const intent=await stripe.paymentIntents.retrieve(intentId,{expand:['latest_charge']});
 if(typeof intent.latest_charge!=='object'||!intent.latest_charge)return;
 const charge=intent.latest_charge,lines=await stripe.checkout.sessions.listLineItems(session.id,{limit:2});
 if(!verifiedPixPayment(order,session,intent,charge,lines))return;
 let disputed=charge.disputed;
 if(disputed){const disputes=await stripe.disputes.list({charge:charge.id,limit:100});disputed=disputes.has_more||disputes.data.length===0||disputes.data.some(d=>!['won','warning_closed'].includes(d.status));}
 const item=await stripeRpc<PixOrder|null>('pix_payment_begin',{p_session:session.id,p_customer:order.customer_id,p_intent:intent.id,p_paid_at:new Date(event.created*1000).toISOString(),p_refunded:charge.refunded,p_disputed:disputed,p_event_at:new Date(event.created*1000).toISOString()});
 if(!item||item.done)return;
 try{await deliverPurchaseAccess(item,async user=>{await stripeRpc('pix_payment_finish',{p_id:item.id,p_lease:item.fulfillment_lease,p_user:user});});}
 catch(error){await stripeRpc('purchase_fulfill_release',{p_id:item.id,p_lease:item.fulfillment_lease});throw error;}
}
