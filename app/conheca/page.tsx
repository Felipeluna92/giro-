import type {Metadata} from 'next';
import SalesPage from '../sales-page';
import {getPublicPlans} from '../../lib/billing-server';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Giro — comandas, entregas e taxas no controle',description:'Comandas por foto, rotas e taxas para motoboys. Entregas, equipe e acertos para comerciantes. Motoboy R$ 29,90/mês, Comerciante R$ 59,90/mês e pacote R$ 39,90 no primeiro mês; depois R$ 89,80/mês.'};
export default async function Conheca(){return <SalesPage plans={await getPublicPlans()}/>;}
