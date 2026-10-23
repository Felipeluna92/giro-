import {cookies} from 'next/headers';
import {portalBody,portalResponse} from '../../../lib/portal-api';
import {stripeConfigured,stripeRpc} from '../../../lib/stripe-server';
import {PURCHASE_COOKIE,purchaseVisitor,purchaseRateKey,createPublicPurchase} from '../../../lib/purchase-server';
import {purchaseEmail,purchasePlan} from '../../../lib/purchase-policy';
import {purchaseMethod} from '../../../lib/pix-policy';
import {pixConfiguration} from '../../../lib/pix-server';
import {checkoutDiagnostic} from '../../../lib/checkout-diagnostic';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 if(!stripeConfigured())return portalResponse({error:'O pagamento está temporariamente indisponível. Tente novamente em instantes.'},503);
 if(Number(request.headers.get('content-length'))>4000)return portalResponse({error:'Pedido inválido.'},400);
 const body=await portalBody(request),plan=purchasePlan(body?.plan),email=purchaseEmail(body?.email),method=purchaseMethod(body?.method),price=body?.priceCents;
 if(!plan||!email||!method||!Number.isInteger(price)||![2990,5990,3990,8980].includes(price))return portalResponse({error:'Confira seu e-mail, a forma de pagamento e o plano escolhido.'},400);
 const jar=await cookies(),visitor=purchaseVisitor(jar.get(PURCHASE_COOKIE)?.value);
 jar.set(PURCHASE_COOKIE,visitor.cookie,{httpOnly:true,secure:new URL(request.url).protocol==='https:',sameSite:'lax',path:'/',maxAge:7*86400});
 try{
  const address=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const checks=await Promise.all([stripeRpc<boolean>('claim_login_attempt',{p_key:purchaseRateKey('visitor:'+visitor.hash),p_limit:10}),stripeRpc<boolean>('claim_login_attempt',{p_key:purchaseRateKey('ip:'+address),p_limit:60})]);
  if(checks.some(ok=>!ok))return portalResponse({error:'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.'},429);
  if(await stripeRpc<boolean>(method==='pix'?'pix_has_overlap':'purchase_has_overlap',{p_email:email,p_plan:plan}))return portalResponse({existingSubscription:true,error:'Este e-mail já possui um plano que se sobrepõe a esta compra. Entre para gerenciar seu acesso e evitar cobranças duplicadas.'},409);
  const config=method==='pix'?await pixConfiguration():null;
  if(method==='pix'&&!config)return portalResponse({error:'O pagamento por Pix está indisponível no momento. Escolha cartão ou tente novamente mais tarde.'},503);
  return portalResponse(await createPublicPurchase(visitor.hash,email,plan,price,method,config??undefined));
 }catch(error){const code=error instanceof Error?error.message:'',diagnostic=checkoutDiagnostic(error);console.error('giro_public_checkout_failed',{checkoutCode:['CHECKOUT_BUSY','PRICE_MISMATCH','PURCHASE_SESSION_EXPIRED'].includes(code)?code:'processing_failed',...diagnostic});return portalResponse({diagnostic,error:code==='CHECKOUT_BUSY'?'Seu pagamento está sendo preparado. Aguarde alguns segundos e tente novamente.':code==='PURCHASE_SESSION_EXPIRED'?'Este checkout expirou. Aguarde alguns minutos e abra uma nova compra.':'Não foi possível abrir o pagamento. Tente novamente em instantes.'},503);}
}
