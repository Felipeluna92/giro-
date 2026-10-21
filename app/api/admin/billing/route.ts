import {portalSession,portalResponse} from '../../../../lib/portal-api';
import {stripeClient,stripeConfigured,stripeRpc} from '../../../../lib/stripe-server';
import {STRIPE_PLANS,STRIPE_COMBO_COUPON,STRIPE_PORTAL_CONFIGURATION} from '../../../../lib/stripe-catalog';
import {stripeObjectId} from '../../../../lib/stripe-events';
export const maxDuration=60;
export async function POST(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 if(!session.user.access.isAdmin)return portalResponse({error:'Acesso exclusivo da administração.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 if(!stripeConfigured())return portalResponse({error:'Falta configurar a chave restrita STRIPE_SECRET_KEY na Vercel e publicar novamente.'},503);
 try{
  const stripe=stripeClient();
  for(const plan of Object.values(STRIPE_PLANS)){
   const price=await stripe.prices.retrieve(plan.price);
   if(!price.livemode||!price.active||price.unit_amount!==plan.priceCents||price.currency!=='brl'||stripeObjectId(price.product)!==plan.product||price.recurring?.interval!=='month'||price.recurring.interval_count!==1)throw new Error('PRICE_MISMATCH');
  }
  const coupon=await stripe.coupons.retrieve(STRIPE_COMBO_COUPON);
  if(!coupon.valid||coupon.amount_off!==4990||coupon.currency!=='brl'||coupon.duration!=='once'||!coupon.applies_to?.products?.includes(STRIPE_PLANS.combo.product))throw new Error('COUPON_MISMATCH');
  const portal=await stripe.billingPortal.configurations.retrieve(STRIPE_PORTAL_CONFIGURATION);
  if(!portal.active||portal.features.subscription_cancel.mode!=='at_period_end')throw new Error('PORTAL_MISMATCH');
  await stripeRpc('stripe_billing_status');
  return portalResponse({success:true,message:'Chave, planos, promoção, portal e banco validados. A confirmação automática ainda deve ser conferida em um pagamento de teste.'});
 }catch{console.error('giro_stripe_setup_validation_failed');return portalResponse({error:'A validação falhou. Confira se a chave pertence à conta correta e tem as permissões indicadas.'},503);}
}
