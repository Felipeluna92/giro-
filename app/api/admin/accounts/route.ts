import {portalBody,portalResponse,portalSession} from '../../../../lib/portal-api';
import {adminAccountAction,adminAccountQuery} from '../../../../lib/admin-accounts-policy';
import {billingClient} from '../../../../lib/billing-server';
import {stripeRpc,siteUrl} from '../../../../lib/stripe-server';
import {deliverPurchaseAccess} from '../../../../lib/purchase-server';
import type {PurchaseBuyer} from '../../../../lib/purchase-policy';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 if(!session.user.access.isAdmin)return portalResponse({error:'Acesso exclusivo da administração.'},403);
 const query=adminAccountQuery(new URL(request.url).searchParams);
 if(!query)return portalResponse({error:'Busca inválida.'},400);
 try{return portalResponse(await stripeRpc('admin_accounts',{p_actor:session.user.userId,p_search:query.search,p_filter:query.filter,p_page:query.page}));}
 catch{return portalResponse({error:'Não foi possível carregar as contas. Tente atualizar.'},503);}
}
export async function POST(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 if(!session.user.access.isAdmin)return portalResponse({error:'Acesso exclusivo da administração.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 if(Number(request.headers.get('content-length'))>4000)return portalResponse({error:'Pedido inválido.'},400);
 const action=adminAccountAction(await portalBody(request));if(!action)return portalResponse({error:'Confira os dados. O teste deve durar de 1 a 30 dias.'},400);
 const actor=session.user.userId;
 try{
  const allowed=await stripeRpc<boolean>('claim_login_attempt',{p_key:'admin-accounts:'+actor,p_limit:20});
  if(!allowed)return portalResponse({error:'Muitas ações seguidas. Aguarde alguns minutos.'},429);
  if(action.action==='trial'){
   const buyer=await stripeRpc<PurchaseBuyer|null>('purchase_buyer',{p_email:action.email});
   if(buyer&&!await stripeRpc<boolean>('admin_trial_eligible',{p_actor:actor,p_target:buyer.id}))return portalResponse({error:'Esta conta já tem plano pago, é administradora ou é um motoboy gerenciado. O teste não foi criado.'},409);
   await deliverPurchaseAccess({email:action.email},async id=>{await stripeRpc('admin_trial_change',{p_actor:actor,p_target:id,p_portal:action.plan,p_days:action.days,p_revoke:false});});
   return portalResponse({message:`Teste de ${action.days} dia(s) liberado. O link para definir a senha foi enviado por e-mail. Sem cobrança automática.`});
  }
  const backend=billingClient(),{data,error}=await backend.auth.admin.getUserById(action.userId);
  if(error||!data.user)return portalResponse({error:'Conta não encontrada.'},404);
  if(action.action==='revoke_trial'){
   await stripeRpc('admin_trial_change',{p_actor:actor,p_target:action.userId,p_portal:null,p_days:null,p_revoke:true});
   return portalResponse({message:'Teste encerrado. Eventuais assinaturas pagas foram preservadas.'});
  }
  const email=data.user.email;
  const buyer=email?await stripeRpc<PurchaseBuyer|null>('purchase_buyer',{p_email:email}):null;
  if(!email||email.endsWith('.invalid')||buyer?.managed)return portalResponse({error:'Este perfil entra por usuário. A senha deve ser gerenciada pelo comerciante em Acesso do motoboy.'},409);
  await stripeRpc('admin_recovery_event',{p_actor:actor,p_target:action.userId,p_action:'recovery_requested'});
  try{
   await deliverPurchaseAccess({email},async()=>{});
   await stripeRpc('admin_recovery_event',{p_actor:actor,p_target:action.userId,p_action:'recovery_sent'});
  }catch{
   await stripeRpc('admin_recovery_event',{p_actor:actor,p_target:action.userId,p_action:'recovery_failed'});
   return portalResponse({error:'O e-mail não pôde ser enviado. Confira o serviço de e-mail e tente novamente em um minuto.'},503);
  }
  return portalResponse({message:'Link enviado. A pessoa escolhe a nova senha pelo próprio e-mail.'});
 }catch(error){
  const busy=error instanceof Error&&error.message==='CHECKOUT_BUSY';
  console.error('giro_admin_account_action_failed',{action:action.action});
  return portalResponse({error:busy?'Aguarde um minuto antes de reenviar para esta conta.':'Não foi possível concluir. Atualize a lista e confira se o acesso foi criado antes de tentar novamente.'},busy?429:503);
 }
}
