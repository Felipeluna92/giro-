import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {billingClient} from '../../../../lib/billing-server';
import {createClient} from '../../../../lib/supabase/server';
import {portalBody,portalResponse} from '../../../../lib/portal-api';
import {usernameSchema} from '../../../../lib/managed-rider';
const schema=z.object({username:usernameSchema,password:z.string().min(1).max(128)});
export const runtime='nodejs';
export async function POST(request:Request){
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 const checked=schema.safeParse(await portalBody(request));if(!checked.success)return portalResponse({error:'Usuário ou senha incorretos.'},401);
 try{
  const backend=billingClient(),input=checked.data;
  const address=(request.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
  const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
  const limits=await Promise.all([backend.rpc('claim_login_attempt',{p_key:hash('user:'+input.username),p_limit:10}),backend.rpc('claim_login_attempt',{p_key:hash('ip:'+address),p_limit:60})]);
  if(limits.some(result=>result.error))return portalResponse({error:'Não foi possível entrar agora. Tente novamente.'},503);
  if(limits.some(result=>result.data!==true))return portalResponse({error:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'},429);
  const {data:email,error}=await backend.rpc('resolve_rider_login',{p_username:input.username});
  if(error)return portalResponse({error:'Não foi possível entrar agora. Tente novamente.'},503);
  // An unknown username also runs through password validation; no alias is returned.
  const supabase=await createClient();
  const result=await supabase.auth.signInWithPassword({email:typeof email==='string'?email:randomUUID()+'@motoboy.giro.invalid',password:input.password});
  if(result.error||!email)return portalResponse({error:'Usuário ou senha incorretos.'},401);
  return portalResponse({success:true,url:'/motoboy'});
 }catch{console.error('rider_login_unavailable');return portalResponse({error:'Não foi possível entrar agora. Tente novamente.'},503);}
}
