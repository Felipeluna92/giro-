import type {Metadata} from 'next';
import SalesPage from '../sales-page';
import {getPublicPlans} from '../../lib/billing-server';
import {salesMetadata,salesStructuredData} from '../../lib/sales-seo';
export const dynamic='force-dynamic';
export const metadata:Metadata=salesMetadata;
export default async function Conheca({searchParams}:{searchParams:Promise<{publico?:string|string[]}>}){
 const [plans,query]=await Promise.all([getPublicPlans(),searchParams]);
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(salesStructuredData()).replace(/</g,'\\u003c')}}/><SalesPage plans={plans} initialAudience={query.publico==='comerciante'?'merchant':'rider'}/></>;
}
