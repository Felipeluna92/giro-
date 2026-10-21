import {getRiderUser} from '../../../../lib/auth';
import {portalResponse} from '../../../../lib/portal-api';
import {createGiroPortal} from '../../../../lib/stripe-server';
export async function POST(request:Request){
 const user=await getRiderUser();if(!user)return portalResponse({error:'Entre na sua conta.'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return portalResponse({error:'Origem inválida.'},403);
 if(user.access.managedRider)return portalResponse({error:'A assinatura é gerenciada pelo comerciante.'},403);
 try{const session=await createGiroPortal(user.userId);return portalResponse({url:session.url});}
 catch(error){return portalResponse({error:error instanceof Error&&error.message==='NO_CUSTOMER'?'Sua conta ainda não tem uma assinatura na Stripe.':'Não foi possível abrir a gestão da assinatura. Tente novamente.'},503);}
}
