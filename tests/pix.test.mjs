import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedPixPayment,purchaseMethod,pixEventCanConfirm} from '../lib/pix-policy.ts';
import {STRIPE_PLANS} from '../lib/stripe-catalog.ts';
function fixture(plan='rider',amount=STRIPE_PLANS[plan].priceCents){return {
 order:{session_id:'cs_fixture',customer_id:'cus_buyer',plan,first_price_cents:amount},
 session:{id:'cs_fixture',livemode:true,mode:'payment',status:'complete',payment_status:'paid',customer:'cus_buyer',payment_intent:'pi_fixture',amount_total:amount,currency:'brl'},
 intent:{id:'pi_fixture',livemode:true,status:'succeeded',customer:'cus_buyer',amount,amount_received:amount,currency:'brl'},
 charge:{id:'ch_fixture',paid:true,status:'succeeded',customer:'cus_buyer',currency:'brl',amount,payment_intent:'pi_fixture',payment_method_details:{type:'pix'}},
 lines:{has_more:false,data:[{quantity:1,price:{unit_amount:amount,currency:'brl',product:STRIPE_PLANS[plan].product,recurring:null}}]}
};}
const verify=f=>verifiedPixPayment(f.order,f.session,f.intent,f.charge,f.lines);
test('Pix accepts only a completed paid one-time checkout backed by the exact successful Pix charge',()=>{
 for(const [plan,amount] of [['rider',2990],['merchant',5990],['combo',3990],['combo',8980]])assert.equal(verify(fixture(plan,amount)),true);
 for(const patch of [{status:'open'},{mode:'subscription'},{payment_status:'unpaid'},{livemode:false},{amount_total:100},{currency:'usd'},{customer:'cus_other'},{payment_intent:'pi_other'},{id:'cs_other'}]){const f=fixture();Object.assign(f.session,patch);assert.equal(verify(f),false);}
});
test('A forged price, unpaid intent, card charge, unrelated customer or changed product cannot grant prepaid access',()=>{
 const changes=[f=>f.order.first_price_cents=100,f=>f.intent.status='processing',f=>f.intent.amount_received=1,f=>f.intent.customer='cus_other',f=>f.charge.customer='cus_other',f=>f.charge.paid=false,f=>f.charge.payment_method_details.type='card',f=>f.charge.payment_intent='pi_other',f=>f.lines.has_more=true,f=>f.lines.data[0].price.product='other_product',f=>f.lines.data[0].price.recurring={interval:'month'},f=>f.lines.data[0].quantity=2];
 for(const change of changes){const f=fixture();change(f);assert.equal(verify(f),false);}
});
test('Checkout method defaults preserve old card clients and reject unsupported values',()=>{
 assert.equal(purchaseMethod(undefined),'card');assert.equal(purchaseMethod('card'),'card');assert.equal(purchaseMethod('pix'),'pix');
 for(const v of [null,'admin','boleto',{},true])assert.equal(purchaseMethod(v),null);
});
test('A delayed historical unpaid completion cannot start a Pix credit before payment',()=>{
 assert.equal(pixEventCanConfirm('checkout.session.completed','unpaid'),false);
 assert.equal(pixEventCanConfirm('checkout.session.completed','paid'),true);
 assert.equal(pixEventCanConfirm('checkout.session.async_payment_succeeded',null),true);
 assert.equal(pixEventCanConfirm('checkout.session.async_payment_failed','paid'),false);
});
