import { NextResponse,type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '../../../lib/supabase/server';
import { safeReturnPath } from '../../../lib/safe-redirect';
export async function GET(request:NextRequest){
 const {searchParams,origin}=new URL(request.url),next=safeReturnPath(searchParams.get('next'));
 const code=searchParams.get('code'),tokenHash=searchParams.get('token_hash'),type=searchParams.get('type');
 const supabase=await createClient();
 if(code){const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(next,origin));}
 else if(tokenHash&&type&&['signup','recovery','email','invite','email_change'].includes(type)){const {error}=await supabase.auth.verifyOtp({token_hash:tokenHash,type:type as EmailOtpType});if(!error)return NextResponse.redirect(new URL(next,origin));}
 return NextResponse.redirect(new URL('/entrar?erro=link-invalido',origin));
}
