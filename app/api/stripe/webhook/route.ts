import Stripe from 'stripe';
import {processStripeEvent} from '../../../../lib/stripe-webhook';
import {STRIPE_EVENTS} from '../../../../lib/stripe-events';
import {STRIPE_ACCOUNT} from '../../../../lib/stripe-catalog';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 const secret=process.env.STRIPE_WEBHOOK_SECRET,signature=request.headers.get('stripe-signature');
 if(!secret)return respond({error:'Webhook not configured'},503);
 if(!signature||signature.length>2000)return respond({error:'Invalid signature'},400);
 if(Number(request.headers.get('content-length'))>1000000)return respond({error:'Payload too large'},413);
 const raw=await request.text();if(Buffer.byteLength(raw)>1000000)return respond({error:'Payload too large'},413);
 let event:Stripe.Event;
 try{event=Stripe.webhooks.constructEvent(raw,signature,secret);}catch{return respond({error:'Invalid signature'},400);}
 if(!event.livemode||(event.account&&event.account!==STRIPE_ACCOUNT))return respond({error:'Wrong account or environment'},400);
 if(!(STRIPE_EVENTS as readonly string[]).includes(event.type))return respond({received:true});
 try{await processStripeEvent(event);return respond({received:true});}
 catch(error){console.error('giro_stripe_webhook_failed',{eventId:event.id,type:event.type,code:error instanceof Stripe.errors.StripeError?error.code:'processing_failed'});return respond({error:'Processing failed; retry required'},503);}
}
