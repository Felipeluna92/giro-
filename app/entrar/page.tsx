import { redirect } from 'next/navigation';
import { getRiderUser } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import AuthForm from './auth-form';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{perfil?:string;cadastro?:string}>}){
 const query=await searchParams,portal=query.perfil==='merchant'?'merchant':query.perfil==='rider'?'rider':undefined;
 if(await getRiderUser())redirect(portal?portal==='merchant'?'/comerciante':'/motoboy':'/');
 return <AuthForm configured={isSupabaseConfigured()} initialPortal={portal} initialMode={query.cadastro==='1'?'signup':'login'}/>;
}
