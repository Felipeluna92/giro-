import test from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {STRIPE_PLANS,plansOverlap} from '../lib/stripe-catalog.ts';
import {subscriptionPlan,invoicePeriod,invoiceIsPaid,invoiceSubscription} from '../lib/stripe-events.ts';
const now=Date.now(),start=Math.floor(now/1000),end=start+30*86400;
function subscription(plan='combo'){return {id:'sub_fixture',customer:'cus_fixture',items:{has_more:false,data:[{quantity:1,price:{id:STRIPE_PLANS[plan].price,currency:'brl',unit_amount:STRIPE_PLANS[plan].priceCents,recurring:{interval:'month',interval_count:1}}}]}};}
function invoice(){return {id:'in_fixture',customer:'cus_fixture',currency:'brl',status:'paid',amount_due:3990,amount_paid:3990,amount_remaining:0,parent:{type:'subscription_details',subscription_details:{subscription:'sub_fixture'}}};}
const line={quantity:1,pricing:{price_details:{price:STRIPE_PLANS.combo.price}},parent:{type:'subscription_item_details',subscription_item_details:{proration:false}},period:{start,end}};
test('Only the configured monthly product tier with one seat is recognized',()=>{
 for(const plan of ['rider','merchant','combo'])assert.equal(subscriptionPlan(subscription(plan)),plan);
 const sub=subscription();sub.items.data[0].quantity=2;assert.equal(subscriptionPlan(sub),null);
 const altered=subscription();altered.items.data[0].price.unit_amount=100;assert.equal(subscriptionPlan(altered),null);
 const yearly=subscription();yearly.items.data[0].price.recurring.interval='year';assert.equal(subscriptionPlan(yearly),null);
 const multi=subscription();multi.items.data.push(multi.items.data[0]);assert.equal(subscriptionPlan(multi),null);
});
test('Invoice ownership and paid period are verified without using metadata',()=>{
 const inv=invoice(),sub=subscription();assert.equal(invoiceSubscription(inv),sub.id);
 assert.equal(invoicePeriod(inv,[line],sub,now),new Date(end*1000).toISOString());
 assert.equal(invoicePeriod({...inv,customer:'cus_other'},[line],sub,now),null);
 assert.equal(invoicePeriod({...inv,parent:null},[line],sub,now),null);
 assert.equal(invoicePeriod(inv,[{...line,period:{start,end:end+35*86400}}],sub,now),null);
 assert.equal(invoicePeriod(inv,[{...line,parent:{type:'subscription_item_details',subscription_item_details:{proration:true}}}],sub,now),null);
});
test('Pending, discounted-below-plan or partially paid invoices never grant access',()=>{
 assert.equal(invoiceIsPaid(invoice(),'combo'),true);
 for(const fields of [{status:'open'},{amount_remaining:1},{amount_paid:0},{amount_due:100,amount_paid:100}])assert.equal(invoiceIsPaid({...invoice(),...fields},'combo'),false);
 assert.equal(invoiceIsPaid(invoice(),'merchant'),false);
});
test('Merchant and bundle overlap; a rider may also buy a bundle for a separate rider',()=>{
 assert.equal(plansOverlap('combo','merchant'),true);assert.equal(plansOverlap('rider','rider'),true);
 assert.equal(plansOverlap('rider','combo'),false);assert.equal(plansOverlap('merchant','rider'),false);
});
test('Webhook verification rejects changed bodies, wrong secrets and replayed signatures',()=>{
 const secret='whsec_local_fixture_only',payload=JSON.stringify({id:'evt_fixture',type:'invoice.paid'});
 const header=Stripe.webhooks.generateTestHeaderString({payload,secret});
 assert.equal(Stripe.webhooks.constructEvent(payload,header,secret).id,'evt_fixture');
 assert.throws(()=>Stripe.webhooks.constructEvent(payload+' ',header,secret));
 assert.throws(()=>Stripe.webhooks.constructEvent(payload,header,'whsec_another_fixture'));
 const expired=Stripe.webhooks.generateTestHeaderString({payload,secret,timestamp:Math.floor(Date.now()/1000)-1000});
 assert.throws(()=>Stripe.webhooks.constructEvent(payload,expired,secret));
});
