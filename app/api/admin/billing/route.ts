import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {portalSession,portalBody,portalResponse} from '../../../../lib/portal-api';
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('webhook'),header:z.string().regex(/^[a-z][a-z0-9-]{0,79}$/)}),
 z.object({action:z.literal('plan'),portal:z.enum(['rider','merchant']),price:z.number().int().min(100).max(10000000).nullable(),checkout:z.string().max(500).refine(v=>!v||/^https:\/\/pay\.kirvano\.com\/\S+$/.test(v)),product:z.string().trim().max(100),offer:z.string().trim().max(100),enabled:z.boolean()})
]);
export async function POST(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 if(!session.user.access.isAdmin)return portalResponse({error:'Acesso exclusivo da administração.'},403);
 const parsed=schema.safeParse(await portalBody(request));if(!parsed.success)return portalResponse({error:'Confira o preço, o link da Kirvano e os identificadores.'},400);
 const body=parsed.data;
 if(body.action==='webhook'){
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  const {error}=await session.supabase.rpc('admin_configure_giro_webhook',{p_hash:hash,p_header:body.header});
  return error?portalResponse({error:'Não foi possível configurar a integração.'},503):portalResponse({token});
 }
 const {error}=await session.supabase.rpc('admin_save_giro_plan',{p_portal:body.portal,p_price:body.price,p_checkout:body.checkout,p_product:body.product,p_offer:body.offer,p_enabled:body.enabled});
 return error?portalResponse({error:'Confira os campos. Configure o token do webhook antes de habilitar as vendas.'},400):portalResponse({success:true});
}
