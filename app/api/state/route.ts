import { getRiderUser } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase/server';
import { emptyState,stateSchema } from '../../../lib/domain';
export const dynamic='force-dynamic';
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const user=await getRiderUser();if(!user)return respond({error:'Entre na sua conta para continuar.'},401);
 const supabase=await createClient();const {data,error}=await supabase.from('rider_workspaces').select('data,revision').eq('owner',user.userId).maybeSingle();
 if(error){console.error('workspace_read_failed',{code:error.code});return respond({error:'Não foi possível carregar seus dados. Verifique a configuração do banco ou tente novamente.'},503);}
 const checked=data?stateSchema.safeParse(data.data):null;
 if(checked&&!checked.success)return respond({error:'O histórico precisa de revisão. Entre em contato com o suporte antes de substituir seus dados.'},422);
 return respond({state:checked?.success?checked.data:emptyState(),revision:data?.revision??0});
}
export async function PUT(request:Request){
 const user=await getRiderUser();if(!user)return respond({error:'Entre na sua conta para continuar.'},401);
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return respond({error:'Origem inválida.'},403);
 const raw=await request.text();if(raw.length>2500000)return respond({error:'Seu histórico atingiu o limite desta versão.'},413);
 let body;try{body=JSON.parse(raw);}catch{return respond({error:'Dados inválidos.'},400);}
 const result=stateSchema.safeParse(body.state);if(!result.success||!Number.isSafeInteger(body.revision)||body.revision<0)return respond({error:result.success?'Versão inválida.':result.error.issues[0]?.message},400);
 const supabase=await createClient();const {data,error}=await supabase.rpc('save_rider_workspace',{p_data:result.data,p_expected_revision:body.revision});
 if(error){if(error.code==='40001')return respond({error:'Seus dados mudaram em outro dispositivo. Recarregue antes de salvar novamente.'},409);console.error('workspace_save_failed',{code:error.code});return respond({error:'Não foi possível salvar no banco. Confira sua conexão e tente novamente.'},503);}
 return respond({revision:data});
}
