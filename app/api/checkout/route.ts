import {getRiderUser} from '../../../lib/auth';
import {portalBody,portalResponse} from '../../../lib/portal-api';
import {createClient} from '../../../lib/supabase/server';
import {portalPath} from '../../../lib/access';
export async function POST(request:Request){
 const user=await getRiderUser();if(!user)return portalResponse({error:'Entre na sua conta para assinar.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 if(!user.emailConfirmed)return portalResponse({error:'Confirme seu e-mail antes de assinar.'},403);
 const body=await portalBody(request),requested:unknown=body?.plan;
 if(requested!=='rider'&&requested!=='merchant')return portalResponse({error:'Plano inválido.'},400);
 const plan=requested;
 if(user.access[plan])return portalResponse({url:portalPath(plan)});
 const {data,error}=await (await createClient()).rpc('get_giro_checkout',{p_portal:plan});
 if(error||typeof data!=='string')return portalResponse({error:'As assinaturas deste plano ainda não foram abertas. Volte em breve.'},503);
 const url=new URL(data);if(url.origin!=='https://pay.kirvano.com')return portalResponse({error:'Checkout indisponível.'},503);
 return portalResponse({url:url.toString()});
}
