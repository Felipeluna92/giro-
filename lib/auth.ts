import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { isSupabaseConfigured } from './supabase/config';
import { accountAccess,type Portal } from './access';
export async function getRiderUser(){
 if(!isSupabaseConfigured())return null;
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return null;
 const {data:access,error:accessError}=await supabase.rpc('get_account_access');
 if(accessError)throw new Error('Não foi possível verificar o acesso à sua conta. Tente novamente.');
 return {userId:user.id,email:user.email||'',emailConfirmed:!!user.email_confirmed_at,access:accountAccess(access),fullName:typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name:null};
}
export async function requireRiderUser(portal:Portal='rider'){const user=await getRiderUser();if(!user)redirect('/entrar?perfil='+portal);if(!user.access[portal])redirect('/assinar?plano='+portal);return user;}
