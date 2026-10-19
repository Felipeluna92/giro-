import { getRiderUser } from '../lib/auth';
import SalesPage from './sales-page';
import {getPublicPlans} from '../lib/billing-server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home(){
 const user=await getRiderUser();
 if(user){
  if(user.access.isAdmin)redirect('/admin');
  const preferred=(await cookies()).get('giro_portal')?.value==='merchant'?'merchant':'rider';
  if(user.access[preferred])redirect(preferred==='merchant'?'/comerciante':'/motoboy');
  if(user.access.rider)redirect('/motoboy');
  if(user.access.merchant)redirect('/comerciante');
  redirect('/assinar?plano='+preferred);
 }
 return <SalesPage plans={await getPublicPlans()}/>;
}
