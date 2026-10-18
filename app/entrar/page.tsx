import { redirect } from 'next/navigation';
import { getRiderUser } from '../../lib/auth';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import AuthForm from './auth-form';
export const dynamic='force-dynamic';
export default async function Login(){if(await getRiderUser())redirect('/');return <AuthForm configured={isSupabaseConfigured()}/>}
