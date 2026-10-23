import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getPublicPlans} from '../../lib/billing-server';
import {purchasePlan} from '../../lib/purchase-policy';
import {pixConfiguration} from '../../lib/pix-server';
import PurchaseForm from './purchase-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Finalizar compra — Giro',robots:{index:false,follow:false}};
export default async function Purchase({searchParams}:{searchParams:Promise<{plano?:string;cancelado?:string;metodo?:string}>}){
 const query=await searchParams,plan=purchasePlan(query.plano??'rider');if(!plan)notFound();
 const [plans,pix]=await Promise.all([getPublicPlans(),pixConfiguration()]);
 const selected=plans.find(p=>p.portal===plan)!;
 return <PurchaseForm plan={selected} canceled={query.cancelado==='1'} pixAvailable={!!pix} initialMethod={query.metodo==='pix'?'pix':'card'}/>;
}
