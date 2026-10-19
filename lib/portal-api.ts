import { getRiderUser } from './auth';
import { createClient } from './supabase/server';
import type { Portal } from './access';

export const portalResponse=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function portalSession(request:Request,portal?:Portal){
 const user=await getRiderUser();
 if(!user)return {error:portalResponse({error:'Entre na sua conta para continuar.'},401)};
 if(portal&&!user.access[portal])return {error:portalResponse({error:'Ative o plano '+(portal==='rider'?'Motoboy':'Comerciante')+' para acessar esta função.',code:'PLAN_REQUIRED',plan:portal},402)};
 const origin=request.headers.get('origin');
 if(request.method!=='GET'&&origin&&origin!==new URL(request.url).origin)return {error:portalResponse({error:'Origem inválida.'},403)};
 return {user,supabase:await createClient()};
}
export async function portalBody(request:Request){
 const raw=await request.text();
 if(raw.length>4000)return null;
 try{return JSON.parse(raw);}catch{return null;}
}
