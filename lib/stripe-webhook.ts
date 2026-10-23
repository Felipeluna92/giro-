import 'server-only';
import type Stripe from 'stripe';
import {stripeClient,stripeRpc} from './stripe-server';
import {invoiceSubscription,invoicePeriod,invoiceIsPaid,stripeObjectId,subscriptionPlan} from './stripe-events';
import {fulfillPublicPurchase} from './purchase-server';
import {STRIPE_PLANS} from './stripe-catalog';
import {syncPixPayment} from './pix-server';
import {pixEventCanConfirm} from './pix-policy';

type InvoiceRecord={id:string;period_end:string;paid:boolean;amount_paid:number;refunded?:boolean;disputed?:boolean};
const date=(seconds:number|null|undefined)=>seconds?new Date(seconds*1000).toISOString():null;

async function recordInvoice(invoice:Stripe.Invoice,subscription:Stripe.Subscription):Promise<InvoiceRecord|null>{
 const stripe=stripeClient(),plan=subscriptionPlan(subscription);
 if(!plan)return null;
 const lines=invoice.lines.has_more?await stripe.invoices.listLineItems(invoice.id,{limit:100}).autoPagingToArray({limit:1000}):invoice.lines.data;
 const until=invoicePeriod(invoice,lines,subscription);
 if(!until)return null;
 let paidAmount=0,fullyRefundedAmount=0;
 if(invoiceIsPaid(invoice,plan)){
  for await(const payment of stripe.invoicePayments.list({invoice:invoice.id,status:'paid',limit:100})){
   if(payment.payment.type!=='payment_intent')continue;
   const id=stripeObjectId(payment.payment.payment_intent);if(!id)continue;
   const intent=await stripe.paymentIntents.retrieve(id,{expand:['latest_charge']});
   if(intent.status!=='succeeded'||stripeObjectId(intent.customer)!==stripeObjectId(subscription.customer))continue;
   const amount=payment.amount_paid??0;paidAmount+=amount;
   const charge=intent.latest_charge;
   if(typeof charge==='object'&&charge?.refunded)fullyRefundedAmount+=amount;
  }
 }
 const paid=invoiceIsPaid(invoice,plan)&&paidAmount>=invoice.amount_due;
 return {id:invoice.id,period_end:until,paid,amount_paid:paid?invoice.amount_paid:0,...(paid&&fullyRefundedAmount>=paidAmount?{refunded:true}:{})};
}

async function syncSubscription(event:Stripe.Event,id:string,invoice?:Stripe.Invoice,disputed?:boolean){
 const stripe=stripeClient();
 const subscription=await stripe.subscriptions.retrieve(id,{expand:['latest_invoice']});
 const plan=subscriptionPlan(subscription),customer=stripeObjectId(subscription.customer);
 if(!plan||!customer||!subscription.livemode)return;
 let record:InvoiceRecord|null=null;
 if(invoice)record=await recordInvoice(invoice,subscription);
 else if(typeof subscription.latest_invoice==='object'&&subscription.latest_invoice)record=await recordInvoice(subscription.latest_invoice,subscription);
 if(record&&disputed!==undefined)record.disputed=disputed;
 if(record?.paid&&!record.refunded&&!record.disputed&&new Date(record.period_end).getTime()>Date.now()&&['active','past_due'].includes(subscription.status))await fulfillPublicPurchase(subscription);
 const canonical=await stripeRpc<string|null>('purchase_canonical_customer',{p_customer:customer});
 await stripeRpc('stripe_apply_event',{
  p_event:`${event.id}:${record?.id??id}`,p_customer:canonical??customer,p_subscription:id,p_plan:plan,p_status:subscription.status,
  p_ended_at:date(subscription.ended_at),p_cancel_at:date(subscription.cancel_at),p_event_at:date(event.created),p_invoice:record,
 });
}

export async function processStripeEvent(event:Stripe.Event){
 // A harmless catalog event verifies real delivery without charging a customer.
 if(event.type==='product.updated'){
  if(Object.values(STRIPE_PLANS).some(plan=>plan.product===event.data.object.id))await stripeRpc('stripe_record_health',{p_event:event.id});
  return;
 }
 const stripe=stripeClient();
 const object=event.data.object;
 if(!('id' in object)||typeof object.id!=='string')return;
 const objectId=object.id;
 if(event.type.startsWith('checkout.session.')){
  const session=await stripe.checkout.sessions.retrieve(objectId);
  if(session.mode==='payment'){if(pixEventCanConfirm(event.type,'payment_status' in object?object.payment_status:null))await syncPixPayment(event,{session:session.id});return;}
  if(session.mode!=='subscription'||session.payment_status!=='paid')return;
  const id=stripeObjectId(session.subscription);if(id)await syncSubscription(event,id);return;
 }
 if(event.type.startsWith('customer.subscription.')){await syncSubscription(event,objectId);return;}
 if(event.type.startsWith('invoice.')){
  const invoice=await stripe.invoices.retrieve(objectId),id=invoiceSubscription(invoice);
  if(id)await syncSubscription(event,id,invoice);return;
 }
 if(event.type==='charge.refunded'||event.type.startsWith('charge.dispute.')){
  let intentId:string|null=null,disputed:boolean|undefined;
  if(event.type==='charge.refunded'){
   const charge=await stripe.charges.retrieve(objectId);intentId=stripeObjectId(charge.payment_intent);
  }else{
   const dispute=await stripe.disputes.retrieve(objectId);
   disputed=!['won','warning_closed'].includes(dispute.status);
   intentId=stripeObjectId(dispute.payment_intent);
   if(!intentId){const charge=await stripe.charges.retrieve(stripeObjectId(dispute.charge)!);intentId=stripeObjectId(charge.payment_intent);}
  }
  if(!intentId)return;
  await syncPixPayment(event,{intent:intentId});
  const invoices=new Set<string>();
  for await(const payment of stripe.invoicePayments.list({payment:{type:'payment_intent',payment_intent:intentId},status:'paid',limit:100})){
   const id=stripeObjectId(payment.invoice);if(id)invoices.add(id);
  }
  for(const id of invoices){const invoice=await stripe.invoices.retrieve(id),sub=invoiceSubscription(invoice);if(sub)await syncSubscription(event,sub,invoice,disputed);}
 }
}
