import {z} from 'zod';
import {portalSession,portalBody,portalResponse} from '../../../lib/portal-api';
import {billingClient} from '../../../lib/billing-server';
import {managedCreateSchema,managedPasswordSchema} from '../../../lib/managed-rider';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){
 const session=await portalSession(request,'merchant');if(session.error)return session.error;
 const {data,error}=await session.supabase.rpc('get_managed_rider');
 return error?portalResponse({error:'Não foi possível consultar o acesso do motoboy.'},503):portalResponse(data);
}
export async function POST(request:Request){
 const session=await portalSession(request,'merchant');if(session.error)return session.error;
 if(!session.user.access.combo)return portalResponse({error:'O cadastro de um motoboy por usuário e senha está incluído no pacote Motoboy + Comerciante.'},402);
 const checked=z.discriminatedUnion('action',[managedCreateSchema,managedPasswordSchema]).safeParse(await portalBody(request));
 if(!checked.success)return portalResponse({error:'Confira o nome e o usuário. A senha precisa de pelo menos 8 caracteres.'},400);
 const action=checked.data;let reservation:string|undefined;
 try{
  const backend=billingClient(),merchant=session.user.userId;
  if(action.action==='password'){
   const {data:account,error}=await backend.rpc('managed_rider_backend',{p_merchant:merchant});
   if(error||account?.state!=='active'||!account.riderId)return portalResponse({error:'Cadastre primeiro o motoboy do seu pacote.'},400);
   const result=await backend.auth.admin.updateUserById(account.riderId,{password:action.password});
   return result.error?portalResponse({error:'Não foi possível atualizar a senha. Confira os requisitos e tente novamente.'},400):portalResponse({success:true,username:account.username});
  }
  const reserved=await backend.rpc('reserve_managed_rider',{p_merchant:merchant,p_username:action.username,p_name:action.name});
  if(reserved.error){const code=reserved.error.code;return portalResponse({error:code==='23505'?'Este usuário já está em uso. Escolha outro.':code==='55P03'?'O cadastro está sendo processado. Aguarde alguns instantes antes de tentar novamente.':code==='23514'?'Seu pacote já tem um cadastro ou existe um cadastro pendente. Atualize a página para continuar.':'Não foi possível autorizar o cadastro. Confira a assinatura do pacote.'},code==='23505'||code==='55P03'?409:400);}
  reservation=reserved.data.reservation;
  const {data:current,error:lookupError}=await backend.rpc('managed_rider_backend',{p_merchant:merchant});
  if(lookupError||current?.reservation!==reservation)throw new Error('Reservation unavailable');
  const result=current.existingAuthId
   ?await backend.auth.admin.updateUserById(current.existingAuthId,{password:action.password,user_metadata:{full_name:action.name}})
   :await backend.auth.admin.createUser({email:reserved.data.email,password:action.password,email_confirm:true,user_metadata:{full_name:action.name},app_metadata:{giro_managed:true}});
  if(result.error)throw new Error('Auth provisioning failed');
  const finished=await backend.rpc('finish_managed_rider',{p_merchant:merchant,p_reservation:reservation});
  if(finished.error)throw new Error('Finalization failed');
  return portalResponse({success:true,username:finished.data});
 }catch{
  if(reservation)try{await billingClient().rpc('release_managed_reservation',{p_merchant:session.user.userId,p_reservation:reservation});}catch{/* A lease also expires automatically. */}
  console.error('managed_rider_provisioning_failed');
  return portalResponse({error:'Não foi possível concluir o cadastro. Atualize a página e tente concluir o cadastro pendente com o mesmo usuário.'},503);
 }
}
