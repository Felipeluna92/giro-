import {getRiderUser} from '../../../lib/auth';
import {portalBody,portalResponse} from '../../../lib/portal-api';
import {portalPath} from '../../../lib/access';
import {createGiroCheckout,stripeConfigured} from '../../../lib/stripe-server';
export const maxDuration=60;
export async function POST(request:Request){
 const user=await getRiderUser();if(!user)return portalResponse({error:'Entre na sua conta para assinar.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 if(!user.emailConfirmed)return portalResponse({error:'Confirme seu e-mail antes de assinar.'},403);
 const body=await portalBody(request),plan:unknown=body?.plan;
 if(plan!=='rider'&&plan!=='merchant'&&plan!=='combo')return portalResponse({error:'Plano inválido.'},400);
 if(user.access.managedRider)return portalResponse({error:'A assinatura do pacote é gerenciada pelo comerciante que criou seu usuário.'},403);
 if(user.access[plan])return portalResponse({url:portalPath(plan)});
 if(!stripeConfigured())return portalResponse({error:'As assinaturas estão em preparação. Volte em breve.'},503);
 try{return portalResponse({url:await createGiroCheckout(user.userId,user.email,plan)});}
 catch(error){
  const code=error instanceof Error?error.message:'';
  if(code==='CHECKOUT_BUSY')return portalResponse({error:'Seu checkout está sendo preparado. Aguarde alguns segundos e tente novamente.'},409);
  if(code==='SUBSCRIPTION_EXISTS')return portalResponse({error:'Você já tem uma assinatura deste plano ou de um pacote que o inclui. Use “Gerenciar assinatura” para conferir o pagamento e evitar outra cobrança.'},409);
  console.error('giro_checkout_failed',{code:['PRICE_MISMATCH','BILLING_DATABASE_ERROR'].includes(code)?code:'stripe_unavailable'});
  return portalResponse({error:'Não foi possível abrir o checkout. Tente novamente em instantes.'},503);
 }
}
