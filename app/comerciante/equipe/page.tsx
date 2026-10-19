import {requireRiderUser} from '../../../lib/auth';
import {createClient} from '../../../lib/supabase/server';
import ManagedRiderForm from './team-form';
export const dynamic='force-dynamic';
export default async function Team(){
 await requireRiderUser('merchant');
 const {data,error}=await (await createClient()).rpc('get_managed_rider');
 if(error)throw new Error('Não foi possível carregar o acesso do motoboy.');
 return <ManagedRiderForm initial={data}/>;
}
