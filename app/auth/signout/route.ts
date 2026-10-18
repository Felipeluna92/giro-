import { NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
export async function POST(request:Request){
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origem inválida.'},{status:403});
 const supabase=await createClient();const {error}=await supabase.auth.signOut();
 if(error)return Response.json({error:'Não foi possível sair. Tente novamente.'},{status:503});
 return NextResponse.redirect(new URL('/entrar',request.url),{status:303});
}
