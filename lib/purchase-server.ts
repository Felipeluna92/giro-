import 'server-only';
import {createHmac,randomUUID,timingSafeEqual,randomBytes} from 'node:crypto';
import type Stripe from 'stripe';
import {stripeClient,stripeRpc,siteUrl} from './stripe-server';
import {billingClient} from './billing-server';
import {STRIPE_PLANS,STRIPE_COMBO_COUPON} from './stripe-catalog';
import {stripeObjectId,subscriptionPlan} from './stripe-events';
import {canFulfillPurchase,deliverBuyerAccess,type PurchaseBuyer} from './purchase-policy';
import type {PlanId} from './access';
export const PURCHASE_COOKIE='giro_purchase';
function digest(value:string){const secret=process.env.STRIPE_WEBHOOK_SECRET;if(!secret)throw new Error('PURCHASE_NOT_CONFIGURED');return createHmac('sha256',secret).update('giro-purchase-v1:'+value).digest('hex');}
export function purchaseVisitor(cookie:string|undefined){
 if(cookie&&cookie.length<200){const [id,signature]=cookie.split('.');if(/^[0-9a-f-]{36}$/.test(id)&&/^[0-9a-f]{64}$/.test(signature||'')&&timingSafeEqual(Buffer.from(signature),Buffer.from(digest('cookie:'+id))))return {cookie,hash:digest('visitor:'+id)};}
 const id=randomUUID();return {cookie:id+'.'+digest('cookie:'+id),hash:digest('visitor:'+id)};
}
export const purchaseRateKey=(value:string)=>digest('rate:'+value);
type Purchase={id:string;lease:string;customer_id:string|null;session_id:string|null;plan:PlanId;email:string;first_price_cents:number;expires_at:string};
export async function createPublicPurchase(visitor:string,email:string,plan:PlanId,quotedPrice:number){
 const item=await stripeRpc<Purchase>('purchase_reserve',{p_visitor:visitor,p_email:email,p_plan:plan});
 let customerId=item.customer_id,sessionId=item.session_id;
 try{
  if(item.first_price_cents!==quotedPrice)return {priceChanged:true,priceCents:item.first_price_cents};
  const stripe=stripeClient();
  if(sessionId){const previous=await stripe.checkout.sessions.retrieve(sessionId);if(previous.status==='open'&&previous.url&&stripeObjectId(previous.customer)===customerId)return {url:previous.url};throw new Error('PURCHASE_SESSION_EXPIRED');}
  if(!customerId){const customer=await stripe.customers.create({email:item.email,preferred_locales:['pt-BR'],metadata:{app:'giro'}},{idempotencyKey:`giro-public-customer:${item.id}`});customerId=customer.id;}
  const selected=STRIPE_PLANS[item.plan],price=await stripe.prices.retrieve(selected.price);
  if(!price.active||!price.livemode||price.currency!=='brl'||price.unit_amount!==selected.priceCents||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||stripeObjectId(price.product)!==selected.product)throw new Error('PRICE_MISMATCH');
  const session=await stripe.checkout.sessions.create({mode:'subscription',customer:customerId,locale:'pt-BR',line_items:[{price:price.id,quantity:1}],metadata:{app:'giro',purchase:item.id},subscription_data:{billing_mode:{type:'flexible'},metadata:{app:'giro'}},integration_identifier:'giro_public_checkout_gnpxrqvs',expires_at:Math.floor(new Date(item.expires_at).getTime()/1000),...(item.plan==='combo'&&item.first_price_cents===3990?{discounts:[{coupon:STRIPE_COMBO_COUPON}]}:{}),success_url:`${siteUrl()}/compra/concluida?session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${siteUrl()}/comprar?plano=${item.plan}&cancelado=1`},{idempotencyKey:`giro-public-checkout:${item.id}`});
  if(!session.url)throw new Error('CHECKOUT_NO_URL');sessionId=session.id;return {url:session.url};
 }finally{await stripeRpc('purchase_finish',{p_id:item.id,p_lease:item.lease,p_customer:customerId,p_session:sessionId});}
}
type Fulfillment={id:string;email:string;plan:PlanId;fulfillment_lease:string;user_id:string|null;done:boolean};
export async function fulfillPublicPurchase(subscription:Stripe.Subscription){
 const customer=stripeObjectId(subscription.customer),plan=subscriptionPlan(subscription);if(!customer||!plan)return;
 const sessionId=await stripeRpc<string|null>('purchase_session',{p_customer:customer});if(!sessionId)return;
 const stripe=stripeClient(),session=await stripe.checkout.sessions.retrieve(sessionId);
 if(!canFulfillPurchase(session,customer,subscription.id))return;
 const item=await stripeRpc<Fulfillment|null>('purchase_fulfill_begin',{p_customer:customer,p_subscription:subscription.id,p_session:session.id});if(!item||item.done)return;
 if(item.plan!==plan)throw new Error('PURCHASE_PLAN_MISMATCH');
 try{
  const backend=billingClient(),redirectTo=`${siteUrl()}/auth/callback?next=/definir-senha`;
  await deliverBuyerAccess({
   readBuyer:()=>stripeRpc<PurchaseBuyer|null>('purchase_buyer',{p_email:item.email}),
   // Do not preserve an attacker-chosen password from an unconfirmed pre-registration.
   resetUnconfirmed:async id=>{const result=await backend.auth.admin.updateUserById(id,{password:randomBytes(48).toString('base64url')});if(result.error)throw new Error('PURCHASE_ACCOUNT_SETUP_FAILED');},
   invite:async()=>{const result=await backend.auth.admin.inviteUserByEmail(item.email,{redirectTo});return result.error||!result.data.user?null:{id:result.data.user.id,confirmed:!!result.data.user.email_confirmed_at,managed:false};},
   recovery:async()=>{const result=await backend.auth.resetPasswordForEmail(item.email,{redirectTo});if(result.error)throw new Error('PURCHASE_EMAIL_FAILED');},
   record:async id=>{await stripeRpc('purchase_fulfill_finish',{p_id:item.id,p_lease:item.fulfillment_lease,p_user:id,p_sent:true});},
  });
 }catch(error){await stripeRpc('purchase_fulfill_release',{p_id:item.id,p_lease:item.fulfillment_lease});throw error;}
}
