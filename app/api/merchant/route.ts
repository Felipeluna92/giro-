import { z } from 'zod';
import { dayKey } from '../../../lib/domain';
import { portalSession,portalResponse,portalBody } from '../../../lib/portal-api';
export const dynamic='force-dynamic';
const actionSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('profile'),name:z.string().trim().min(1).max(100),address:z.string().trim().max(300)}),
 z.object({action:z.literal('invite')}),
 z.object({action:z.literal('disconnect'),linkId:z.string().uuid()})
]);
export async function GET(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 const day=new URL(request.url).searchParams.get('day')||dayKey();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day)))return portalResponse({error:'Data inválida.'},400);
 const {data,error}=await session.supabase.rpc('merchant_dashboard',{p_day:day});
 if(error){console.error('merchant_read_failed',{code:error.code});return portalResponse({error:'Não foi possível atualizar o painel do comércio.'},503);}
 return portalResponse(data);
}
export async function POST(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 const checked=actionSchema.safeParse(await portalBody(request));
 if(!checked.success)return portalResponse({error:'Confira os dados informados.'},400);
 const action=checked.data;
 const result=action.action==='profile'?await session.supabase.rpc('merchant_setup',{p_name:action.name,p_address:action.address}):action.action==='invite'?await session.supabase.rpc('merchant_invite'):await session.supabase.rpc('disconnect_merchant',{p_link:action.linkId});
 if(result.error){console.error('merchant_write_failed',{code:result.error.code});return portalResponse({error:action.action==='invite'?'Não foi possível gerar o código. Salve o comércio e tente novamente.':'Não foi possível salvar a alteração.'},400);}
 return portalResponse(action.action==='invite'?{code:result.data,expiresInDays:7}:{success:true});
}
