import 'server-only';
import StripeClient from 'stripe';
import {billingClient} from './billing-server';
import {STRIPE_ACCOUNT,STRIPE_API_VERSION,STRIPE_PLANS,STRIPE_COMBO_COUPON,STRIPE_PORTAL_CONFIGURATION,plansOverlap} from './stripe-catalog';
import {subscriptionPlan,stripeObjectId} from './stripe-events';
import type {PlanId} from './access';

export function stripeConfigured(){
 return /^(rk|sk)_live_/.test(process.env.STRIPE_SECRET_KEY||'')&&!!process.env.STRIPE_WEBHOOK_SECRET&&process.env.STRIPE_ACCOUNT_ID===STRIPE_ACCOUNT;
}
export function stripeClient(){
 const key=process.env.STRIPE_SECRET_KEY;
 if(!key||!stripeConfigured())throw new Error('STRIPE_NOT_CONFIGURED');
 return new StripeClient(key,{apiVersion:STRIPE_API_VERSION,maxNetworkRetries:2,timeout:15000,appInfo:{name:'Giro',url:'https://giro-beryl.vercel.app'}});
}
export function siteUrl(){
 const url=new URL(process.env.NEXT_PUBLIC_SITE_URL||'https://giro-beryl.vercel.app');
 if(url.protocol!=='https:')throw new Error('INVALID_SITE_URL');
 return url.origin;
}
export async function stripeRpc<T=unknown>(name:string,args:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await billingClient().rpc(name,args);
 if(error)throw new Error(error.code==='55P03'?'CHECKOUT_BUSY':'BILLING_DATABASE_ERROR');
 return data as T;
}
export async function customerForUser(userId:string,email:string){
 const existing=await stripeRpc<string|null>('stripe_customer',{p_user:userId});
 if(existing)return existing;
 const customer=await stripeClient().customers.create({email,preferred_locales:['pt-BR'],metadata:{app:'giro'}},{idempotencyKey:`giro-customer:${userId}`});
 return stripeRpc<string>('stripe_bind_customer',{p_user:userId,p_customer:customer.id});
}
export async function createGiroCheckout(userId:string,email:string,plan:PlanId){
 const stripe=stripeClient();
 const lease=await stripeRpc<{lease:string;attempt:string;session_id:string|null;plan:PlanId;intro_used:boolean}>('stripe_checkout_reserve',{p_user:userId,p_plan:plan});
 let sessionId:string|null=null;
 try{
  const customer=await customerForUser(userId,email);
  // Avoid duplicate or overlapping renewals, including payments still awaiting confirmation.
  for await(const subscription of stripe.subscriptions.list({customer,status:'all',limit:100})){
   const other=subscriptionPlan(subscription);
   if(other&&plansOverlap(plan,other)&&!['canceled','incomplete_expired'].includes(subscription.status))throw new Error('SUBSCRIPTION_EXISTS');
  }
  let attempt=lease.attempt;
  if(lease.session_id){
   const previous=await stripe.checkout.sessions.retrieve(lease.session_id);
   if(stripeObjectId(previous.customer)!==customer)throw new Error('CHECKOUT_OWNER_MISMATCH');
   if(previous.status==='open'&&lease.plan===plan&&previous.url)return previous.url;
   if(previous.status==='open')await stripe.checkout.sessions.expire(previous.id);
   attempt=await stripeRpc<string>('stripe_checkout_rotate',{p_user:userId,p_lease:lease.lease,p_plan:plan});
  }else if(lease.plan!==plan){attempt=await stripeRpc<string>('stripe_checkout_rotate',{p_user:userId,p_lease:lease.lease,p_plan:plan});}
  const price=await stripe.prices.retrieve(STRIPE_PLANS[plan].price);
  if(!price.active||!price.livemode||price.unit_amount!==STRIPE_PLANS[plan].priceCents||price.currency!=='brl'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1||stripeObjectId(price.product)!==STRIPE_PLANS[plan].product)throw new Error('PRICE_MISMATCH');
  const session=await stripe.checkout.sessions.create({
   mode:'subscription',customer,locale:'pt-BR',client_reference_id:userId,
   line_items:[{price:price.id,quantity:1}],
   subscription_data:{billing_mode:{type:'flexible'},metadata:{app:'giro'}},
   metadata:{app:'giro',attempt},
   integration_identifier:'giro_subscription_rkmbvazq',
   ...(plan==='combo'&&!lease.intro_used?{discounts:[{coupon:STRIPE_COMBO_COUPON}]}:{}),
   success_url:`${siteUrl()}/assinar?plano=${plan}&pagamento=recebido`,
   cancel_url:`${siteUrl()}/assinar?plano=${plan}&pagamento=cancelado`,
  },{idempotencyKey:`giro-checkout:${attempt}`});
  if(!session.url)throw new Error('CHECKOUT_NO_URL');
  sessionId=session.id;
  return session.url;
 }finally{await stripeRpc('stripe_checkout_finish',{p_user:userId,p_lease:lease.lease,p_session:sessionId});}
}
export type OwnedStripeCustomer={id:string;plans:PlanId[]};
export async function createGiroPortal(userId:string,requested?:string){
 const owned=await stripeRpc<OwnedStripeCustomer[]>('stripe_owned_customers',{p_user:userId});
 const customer=requested?owned.find(item=>item.id===requested)?.id:owned[0]?.id;
 if(!customer)throw new Error('NO_CUSTOMER');
 return stripeClient().billingPortal.sessions.create({customer,configuration:STRIPE_PORTAL_CONFIGURATION,return_url:`${siteUrl()}/assinar`,locale:'pt-BR'});
}
