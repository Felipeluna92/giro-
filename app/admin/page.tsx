import {notFound,redirect} from 'next/navigation';
import {getRiderUser} from '../../lib/auth';
import {createClient} from '../../lib/supabase/server';
import AdminBilling from './settings';
export const dynamic='force-dynamic';
export default async function Admin(){
 const user=await getRiderUser();if(!user)redirect('/entrar');if(!user.access.isAdmin)notFound();
 const {data,error}=await (await createClient()).rpc('admin_billing_settings');
 if(error)throw new Error('Não foi possível carregar as configurações de cobrança.');
 return <AdminBilling settings={data}/>;
}
