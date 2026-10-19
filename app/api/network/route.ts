import { z } from 'zod';
import { portalSession,portalResponse,portalBody } from '../../../lib/portal-api';
export const dynamic='force-dynamic';
const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('connect'),code:z.string().trim().toLowerCase().regex(/^[0-9a-f]{32}$/),placeId:z.string().uuid(),name:z.string().trim().min(1).max(80),consent:z.literal(true)}),
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
 if(error)return portalResponse({error:error.code==='23514'?'Este estabelecimento já possui vínculo. Desvincule antes de trocar.':'Código inválido, expirado ou já utilizado. Peça um novo código ao comerciante.'},400);
 return portalResponse({success:true,merchantName:data});
}
