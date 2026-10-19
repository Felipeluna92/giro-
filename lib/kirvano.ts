import {z} from 'zod';
const payloadSchema=z.object({
 event:z.string().max(60),sale_id:z.string().min(1).max(100).optional(),
 type:z.string().optional(),status:z.string().optional(),created_at:z.string().optional(),
 customer:z.object({email:z.string().email().max(254)}).optional(),
 plan:z.object({next_charge_date:z.string().optional()}).optional(),
 products:z.array(z.object({id:z.string().max(100),offer_id:z.string().max(100).optional()})).max(30).optional()
});
export type WebhookPlan={portal:'rider'|'merchant';productId:string;offerId:string};
export type SubscriptionEvent={sale:string;portal:'rider'|'merchant';email:string;event:string;occurred:string;until:string|null};
export function kirvanoDate(value:string|undefined):string|null{
 if(!value)return null;
 const match=value.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})?$/);
 if(!match)return null;
 const [year,month,day,hour,minute,second]=match.slice(1,7).map(Number);
 if(month<1||month>12||day<1||day>new Date(Date.UTC(year,month,0)).getUTCDate()||hour>23||minute>59||second>59)return null;
 // Kirvano examples use local Brazilian timestamps without an offset.
 const time=Date.parse(value.replace(' ','T')+(match[7]?'':'-03:00'));
 return Number.isFinite(time)?new Date(time).toISOString():null;
}
export function subscriptionEvents(raw:unknown,plans:WebhookPlan[],now=Date.now()):SubscriptionEvent[]{
 const p=payloadSchema.parse(raw);
 const grants=['SALE_APPROVED','SUBSCRIPTION_RENEWED'];
 if(![...grants,'SUBSCRIPTION_CANCELED','SUBSCRIPTION_EXPIRED','SALE_REFUNDED','SALE_CHARGEBACK'].includes(p.event))return [];
 if(!p.sale_id||!p.customer||!p.products)throw new Error('Missing sale data');
 const matched=plans.filter(plan=>p.products!.some(product=>product.id===plan.productId&&product.offer_id===plan.offerId));
 if(!matched.length)return [];
 const occurred=kirvanoDate(p.created_at);
 if(!occurred||Date.parse(occurred)>now+600000)throw new Error('Invalid event time');
 let until:string|null=null;
 if(grants.includes(p.event)){
  until=kirvanoDate(p.plan?.next_charge_date);
  if(p.type!=='RECURRING'||p.status!=='APPROVED'||!until||Date.parse(until)<=Date.parse(occurred)||Date.parse(until)-Date.parse(occurred)>35*86400000)throw new Error('Unconfirmed monthly subscription');
 }
 return matched.map(plan=>({sale:p.sale_id!,portal:plan.portal,email:p.customer!.email.trim().toLowerCase(),event:p.event,occurred,until}));
}
