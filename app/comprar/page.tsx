import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {getPublicPlans} from '../../lib/billing-server';
import {purchasePlan} from '../../lib/purchase-policy';
import PurchaseForm from './purchase-form';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Finalizar compra — Giro',robots:{index:false,follow:false}};
export default async function Purchase({searchParams}:{searchParams:Promise<{plano?:string;cancelado?:string}>}){
 const query=await searchParams,plan=purchasePlan(query.plano??'rider');if(!plan)notFound();
 const selected=(await getPublicPlans()).find(p=>p.portal===plan)!;
 return <PurchaseForm plan={selected} canceled={query.cancelado==='1'}/>;
}
