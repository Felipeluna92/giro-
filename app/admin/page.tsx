import {notFound,redirect} from 'next/navigation';
import type {Metadata} from 'next';
import {getRiderUser} from '../../lib/auth';
import {stripeRpc} from '../../lib/stripe-server';
import type {AdminAccountData} from '../../lib/admin-accounts-policy';
import AdminAccounts from './accounts';
import './admin.css';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Administração · Giro',robots:{index:false,follow:false}};
export default async function Admin(){
 const user=await getRiderUser();if(!user)redirect('/entrar');if(!user.access.isAdmin)notFound();
 let initial:AdminAccountData|null=null;
 try{initial=await stripeRpc<AdminAccountData>('admin_accounts',{p_actor:user.userId});}catch{console.error('giro_admin_accounts_unavailable');}
 return <AdminAccounts initial={initial}/>;
}
