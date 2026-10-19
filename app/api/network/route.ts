import { z } from 'zod';
import { portalSession,portalResponse,portalBody } from '../../../lib/portal-api';
export const dynamic='force-dynamic';
const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('connect'),code:z.string().max(128).transform(value=>value.replace(/\s/g,'').toLowerCase()).pipe(z.string().regex(/^[0-9a-f]{32}$/)),placeId:z.string().uuid(),name:z.string().trim().min(1).max(80),consent:z.literal(true)}),
 z.object({action:z.literal('disconnect'),linkId:z.string().uuid()})
]);
export async function GET(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 const {data,error}=await session.supabase.rpc('rider_network');
 if(error)return portalResponse({error:'Não foi possível carregar os vínculos.'},503);
 return portalResponse({links:data});
}
export async function POST(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 const parsed=actionSchema.safeParse(await portalBody(request));
 if(!parsed.success)return portalResponse({error:'Confira o código, o estabelecimento e a confirmação de compartilhamento.'},400);
 const action=parsed.data;
 const {data,error}=action.action==='connect'?await session.supabase.rpc('rider_connect',{p_code:action.code,p_establishment:action.placeId,p_name:action.name}):await session.supabase.rpc('disconnect_merchant',{p_link:action.linkId});
 if(error){
  const messages:Record<string,string>={
   GRC01:'Código não encontrado. Confira se copiou o código completo do comerciante.',
   GRC02:'Este código expirou. Peça um novo código ao comerciante.',
   GRC03:'Este código já foi utilizado. Confira seus vínculos ou peça um novo código ao comerciante.',
   '23514':'Este estabelecimento já possui vínculo. Desvincule antes de trocar.',
   '42501':'Não foi possível autorizar o vínculo. Atualize a página e selecione um estabelecimento da sua conta.'
  };
  const message=messages[error.code];
  if(!message)console.error('Giro network operation failed',{action:action.action,code:error.code});
  return portalResponse({error:message||'Não foi possível concluir a operação agora. Tente novamente em instantes.'},message?400:503);
 }
 return portalResponse({success:true,merchantName:data});
}
