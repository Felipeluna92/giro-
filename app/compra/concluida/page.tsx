import type {Metadata} from 'next';
import PurchaseComplete from './purchase-complete';
export const metadata:Metadata={title:'Sua compra — Giro',robots:{index:false,follow:false}};
export default function Complete(){return <PurchaseComplete/>;}
