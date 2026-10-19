import test from 'node:test';
import assert from 'node:assert/strict';
import {accountAccess} from '../lib/access.ts';
import {subscriptionEvents,kirvanoDate} from '../lib/kirvano.ts';
const now=Date.parse('2026-10-19T12:00:00Z');
const plans=[{portal:'rider',productId:'giro-rider',offerId:'monthly-rider'},{portal:'merchant',productId:'giro-merchant',offerId:'monthly-merchant'}];
const paid={event:'SALE_APPROVED',sale_id:'TEST-SALE',type:'RECURRING',status:'APPROVED',created_at:'2026-10-19 09:00:00',customer:{email:'Rider@example.invalid'},plan:{next_charge_date:'2026-11-19 09:00:00'},products:[{id:'giro-rider',offer_id:'monthly-rider'}]};
test('Kirvano only grants a confirmed monthly subscription for the configured product and offer',()=>{
 const events=subscriptionEvents(paid,plans,now);
 assert.equal(events.length,1);assert.equal(events[0].portal,'rider');assert.equal(events[0].email,'rider@example.invalid');
 assert.equal(events[0].until,'2026-11-19T12:00:00.000Z');
 assert.deepEqual(subscriptionEvents({...paid,products:[{id:'another-product',offer_id:'monthly-rider'}]},plans,now),[]);
 assert.deepEqual(subscriptionEvents({...paid,products:[{id:'giro-rider',offer_id:'wrong-offer'}]},plans,now),[]);
});
test('A generated Pix, pending payment, one-time sale or unknown paid-through date never grants access',()=>{
 assert.deepEqual(subscriptionEvents({...paid,event:'PIX_GENERATED',status:'PENDING'},plans,now),[]);
 for(const altered of [{status:'PENDING'},{type:'ONE_TIME'},{plan:undefined},{plan:{next_charge_date:'2027-10-19 09:00:00'}},{created_at:'2027-01-01 09:00:00'}])assert.throws(()=>subscriptionEvents({...paid,...altered},plans,now));
});
test('Kirvano cancellation and refund are processed without inventing another paid period',()=>{
 for(const event of ['SUBSCRIPTION_CANCELED','SUBSCRIPTION_EXPIRED','SALE_REFUNDED','SALE_CHARGEBACK']){
  const result=subscriptionEvents({...paid,event,plan:undefined},plans,now);
  assert.equal(result[0].event,event);assert.equal(result[0].until,null);
 }
});
test('Dates follow the Brazilian examples and reject impossible dates',()=>{
 assert.equal(kirvanoDate('2026-10-19 09:00:00'),'2026-10-19T12:00:00.000Z');
 assert.equal(kirvanoDate('2026-10-19T12:00:00Z'),'2026-10-19T12:00:00.000Z');
 assert.equal(kirvanoDate('2026-02-30 09:00:00'),null);
 assert.equal(kirvanoDate('2026-10-19 25:00:00'),null);
});
test('Authorization fails closed and never treats strings or metadata-like objects as admin flags',()=>{
 assert.deepEqual(accountAccess(null),{isAdmin:false,rider:false,merchant:false});
 assert.deepEqual(accountAccess({isAdmin:'true',rider:1,merchant:'yes',user_metadata:{role:'admin'}}),{isAdmin:false,rider:false,merchant:false});
 assert.deepEqual(accountAccess({isAdmin:false,rider:true,merchant:false}),{isAdmin:false,rider:true,merchant:false});
});
