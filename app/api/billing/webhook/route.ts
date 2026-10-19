import {createHash,timingSafeEqual} from 'node:crypto';
import {billingClient} from '../../../../lib/billing-server';
import {subscriptionEvents,type WebhookPlan} from '../../../../lib/kirvano';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const respond=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
 try{
  const backend=billingClient();
  const {data:config,error}=await backend.rpc('get_giro_webhook_config');
  if(error||!config)return respond({error:'Webhook not configured'},503);
  const token=request.headers.get(config.headerName);
  if(!token||token.length>512)return respond({error:'Unauthorized'},401);
  const actual=createHash('sha256').update(token).digest(),expected=Buffer.from(config.secretHash,'hex');
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return respond({error:'Unauthorized'},401);
  if(Number(request.headers.get('content-length'))>100000)return respond({error:'Payload too large'},413);
  const raw=await request.text();if(raw.length>100000)return respond({error:'Payload too large'},413);
  let events;try{events=subscriptionEvents(JSON.parse(raw),(config.plans||[]) as WebhookPlan[]);}catch{return respond({error:'Invalid subscription event'},422);}
  const verified=await backend.rpc('verify_giro_webhook');if(verified.error)return respond({error:'Processing failed'},503);
  for(const event of events){
   const result=await backend.rpc('apply_giro_subscription',{p_sale:event.sale,p_portal:event.portal,p_email:event.email,p_event:event.event,p_occurred:event.occurred,p_until:event.until});
   if(result.error){console.error('giro_billing_event_failed',{code:result.error.code});return respond({error:'Processing failed'},503);}
  }
  return respond({received:true});
 }catch{console.error('giro_billing_backend_unavailable');return respond({error:'Billing unavailable'},503);}
}
