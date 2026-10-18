import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/config';
export async function getRiderUser(){
 if(!isSupabaseConfigured())return null;
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return null;
 return {userId:user.id,email:user.email||'',fullName:typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:null};
}
export async function requireRiderUser(){const user=await getRiderUser();if(!user)redirect('/entrar');return user;}
