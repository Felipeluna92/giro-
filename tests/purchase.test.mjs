import test from 'node:test';
import assert from 'node:assert/strict';
import {purchasePlan,purchaseEmail,canFulfillPurchase} from '../lib/purchase-policy.ts';
test('Public checkout accepts only supported plans and an email, never an access flag',()=>{
 assert.equal(purchasePlan('rider'),'rider');assert.equal(purchasePlan('merchant'),'merchant');assert.equal(purchasePlan('combo'),'combo');
 for(const value of [null,'admin',{plan:'rider'},'__proto__'])assert.equal(purchasePlan(value),null);
 assert.equal(purchaseEmail(' Buyer@Example.com '),'buyer@example.com');
 for(const email of [null,'','missing-at','a@b','a\n@b.com','user@example.invalid','x'.repeat(255)+'@example.com'])assert.equal(purchaseEmail(email),null);
});
test('Public purchase fulfillment requires a paid completed subscription session owned by the stored customer',()=>{
 const session={mode:'subscription',status:'complete',payment_status:'paid',customer:'cus_owner',subscription:'sub_paid'};
 assert.equal(canFulfillPurchase(session,'cus_owner','sub_paid'),true);
 assert.equal(canFulfillPurchase({...session,customer:{id:'cus_owner'},subscription:{id:'sub_paid'}},'cus_owner','sub_paid'),true);
 for(const patch of [{mode:'payment'},{status:'open'},{payment_status:'unpaid'},{payment_status:'no_payment_required'},{customer:'cus_attacker'},{subscription:'sub_other'}])assert.equal(canFulfillPurchase({...session,...patch},'cus_owner','sub_paid'),false);
});
import {deliverBuyerAccess} from '../lib/purchase-policy.ts';
function deliveryFixture(buyer=null){const calls=[];return {calls,io:{readBuyer:async()=>buyer,resetUnconfirmed:async()=>{calls.push('reset');},invite:async()=>{calls.push('invite');return {id:'new-buyer',confirmed:false,managed:false};},recovery:async()=>{calls.push('recovery');},record:async id=>{calls.push('record:'+id);}}};}
test('A new paid buyer is invited; account linking happens only after delivery succeeds',async()=>{
 const {io,calls}=deliveryFixture();await deliverBuyerAccess(io);assert.deepEqual(calls,['invite','record:new-buyer']);
 const failed=deliveryFixture();failed.io.invite=async()=>null;await assert.rejects(()=>deliverBuyerAccess(failed.io),/EMAIL_FAILED/);assert.deepEqual(failed.calls,[]);
});
test('An existing confirmed account keeps its password and receives a recovery link',async()=>{
 const {io,calls}=deliveryFixture({id:'existing',confirmed:true,managed:false});await deliverBuyerAccess(io);assert.deepEqual(calls,['recovery','record:existing']);
});
test('An unconfirmed pre-registration cannot retain an attacker-chosen password',async()=>{
 const {io,calls}=deliveryFixture({id:'unconfirmed',confirmed:false,managed:false});await deliverBuyerAccess(io);assert.deepEqual(calls,['reset','invite','record:new-buyer']);
});
test('Email failures never mark delivery complete and managed logins cannot be repurposed',async()=>{
 const fail=deliveryFixture({id:'existing',confirmed:true,managed:false});fail.io.recovery=async()=>{throw Error('SMTP_UNAVAILABLE');};await assert.rejects(()=>deliverBuyerAccess(fail.io),/SMTP_UNAVAILABLE/);assert.deepEqual(fail.calls,[]);
 const managed=deliveryFixture({id:'managed',confirmed:true,managed:true});await assert.rejects(()=>deliverBuyerAccess(managed.io),/MANAGED_ACCOUNT/);assert.deepEqual(managed.calls,[]);
});
