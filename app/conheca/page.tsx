import type {Metadata} from 'next';
import SalesPage from '../sales-page';
import {getPublicPlans} from '../../lib/billing-server';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Giro — seu corre merece um giro a mais',description:'Conheça o Giro para motoboys e comerciantes. Comandas por foto, rotas, entregas e taxas organizadas. Plano Motoboy por R$ 29,90 por mês.'};
export default async function Conheca(){return <SalesPage plans={await getPublicPlans()}/>;}
