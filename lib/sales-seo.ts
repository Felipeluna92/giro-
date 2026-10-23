import {salesFaq} from './sales-content.ts';
const base='https://giro-beryl.vercel.app';
export const salesMetadata={
 title:'Giro | Entregas e taxas no controle. Para motoboy e comércio.',
 description:'Leia comandas por foto, organize até 8 paradas e confira suas taxas. Para comerciantes: entregas, equipe e acertos. Motoboy R$ 29,90/mês; Comerciante R$ 59,90/mês.',
 alternates:{canonical:base+'/conheca'},
 openGraph:{type:'website' as const,locale:'pt_BR',url:base+'/conheca',siteName:'Giro',title:'Cada entrega conta. Cada taxa também. | Giro',description:'Seu turno ou seu delivery no controle. Motoboy R$ 29,90/mês. Comerciante R$ 59,90/mês. Pacote R$ 39,90 no primeiro mês; depois R$ 89,80/mês.',images:[{url:base+'/conheca/opengraph-image',width:1200,height:630,alt:'Giro: entregas e taxas no controle, para motoboys e comerciantes.'}]},
 twitter:{card:'summary_large_image' as const,title:'Giro — entregas e taxas no controle',description:'Comandas, rotas e saldo para motoboys. Equipe e acertos para comerciantes.',images:[base+'/conheca/opengraph-image']},
};
export function salesStructuredData(){
 const products=[
  {id:'rider',name:'Giro Motoboy',price:'29.90',description:'Assinatura mensal para motoboy. Até 40 leituras por IA/dia com revisão; rota com até 8 paradas. Uso independente, sem loja vinculada.'},
  {id:'merchant',name:'Giro Comerciante',price:'59.90',description:'Assinatura mensal para comerciante. Equipe por convite aceito, entregas, localização autorizada e acertos por motoboy.'},
  {id:'combo',name:'Giro — Os dois juntos',price:'39.90',description:'1 conta Comerciante + 1 conta Motoboy. R$ 39,90 apenas no primeiro mês, uma vez por conta compradora. Depois, R$ 89,80/mês. No Pix quando disponível: períodos de 30 dias, sem débito automático.'},
 ];
 return {'@context':'https://schema.org','@graph':[
  ...products.map(product=>({'@type':'Product','@id':base+'/conheca#plano-'+product.id,name:product.name,description:product.description,brand:{'@type':'Brand',name:'Giro'},url:base+'/conheca#planos',image:base+'/conheca/opengraph-image',offers:{'@type':'Offer',url:base+'/comprar?plano='+product.id,priceCurrency:'BRL',price:product.price,description:product.description,priceSpecification:{'@type':'UnitPriceSpecification',priceCurrency:'BRL',price:product.price,billingDuration:'P1M'}}})),
  {'@type':'FAQPage','@id':base+'/conheca#duvidas',mainEntity:salesFaq.map(faq=>({'@type':'Question',name:faq.question,acceptedAnswer:{'@type':'Answer',text:faq.answer}}))},
 ]};
}
