import DefinePassword from '../definir-senha/password-form';
import {isSupabaseConfigured} from '../../lib/supabase/config';
export const dynamic='force-dynamic';
export default function Reset(){return <DefinePassword configured={isSupabaseConfigured()}/>;}
