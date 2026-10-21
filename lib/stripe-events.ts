import type Stripe from 'stripe';
import {planForPrice,STRIPE_PLANS,STRIPE_FIRST_MONTH_CENTS} from './stripe-catalog.ts';
import type {PlanId} from './access';

export const stripeObjectId=(value:string|{id:string}|null|undefined)=>typeof value==='string'?value:value?.id??null;
export function subscriptionPlan(subscription:Stripe.Subscription):PlanId|null {
 if(subscription.items.has_more||subscription.items.data.length!==1)return null;
 const item=subscription.items.data[0],plan=planForPrice(item.price.id);
 if(!plan||item.quantity!==1||item.price.currency!=='brl'||item.price.unit_amount!==STRIPE_PLANS[plan].priceCents||item.price.recurring?.interval!=='month'||item.price.recurring.interval_count!==1)return null;
 return plan;
}
export function invoiceSubscription(invoice:Stripe.Invoice){
 return invoice.parent?.type==='subscription_details'?stripeObjectId(invoice.parent.subscription_details?.subscription):null;
}
export function invoicePeriod(invoice:Stripe.Invoice,lines:Stripe.InvoiceLineItem[],subscription:Stripe.Subscription,now=Date.now()){
 const plan=subscriptionPlan(subscription);
 if(!plan||invoiceSubscription(invoice)!==subscription.id||stripeObjectId(invoice.customer)!==stripeObjectId(subscription.customer)||invoice.currency!=='brl')return null;
 const matching=lines.filter(line=>stripeObjectId(line.pricing?.price_details?.price)===STRIPE_PLANS[plan].price&&line.parent?.type==='subscription_item_details'&&!line.parent.subscription_item_details?.proration&&line.quantity===1);
 if(matching.length!==1)return null;
 const period=matching[0].period;
 if(!Number.isInteger(period.start)||!Number.isInteger(period.end)||period.end<=period.start||period.end-period.start>35*86400||period.start*1000>now+600000||period.end*1000>now+35*86400000)return null;
 return new Date(period.end*1000).toISOString();
}
export function invoiceIsPaid(invoice:Stripe.Invoice,plan:PlanId){
 const minimum=plan==='combo'?STRIPE_FIRST_MONTH_CENTS:STRIPE_PLANS[plan].priceCents;
 return invoice.status==='paid'&&invoice.amount_remaining===0&&invoice.amount_due>=minimum&&invoice.amount_paid>=invoice.amount_due;
}
export const STRIPE_EVENTS=[
 'product.updated',
 'checkout.session.completed','checkout.session.async_payment_succeeded','checkout.session.async_payment_failed',
 'customer.subscription.created','customer.subscription.updated','customer.subscription.deleted',
 'invoice.paid','invoice.payment_failed','invoice.payment_action_required',
 'charge.refunded','charge.dispute.created','charge.dispute.updated','charge.dispute.closed',
] as const;
