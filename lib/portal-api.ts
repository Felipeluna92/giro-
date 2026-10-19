import { getRiderUser } from './auth';
import { createClient } from './supabase/server';

export const portalResponse=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function portalSession(request:Request){
 const user=await getRiderUser();
 if(!user)return {error:portalResponse({error:'Entre na sua conta para continuar.'},401)};
 const origin=request.headers.get('origin');
 if(request.method!=='GET'&&origin&&origin!==new URL(request.url).origin)return {error:portalResponse({error:'Origem inválida.'},403)};
 return {user,supabase:await createClient()};
}
export async function portalBody(request:Request){
 const raw=await request.text();
 if(raw.length>4000)return null;
 try{return JSON.parse(raw);}catch{return null;}
}
