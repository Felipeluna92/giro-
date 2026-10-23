import {STRIPE_PLANS} from './stripe-catalog.ts';
import type {PlanId} from './access';
export type PurchaseMethod='card'|'pix';
export const purchaseMethod=(value:unknown):PurchaseMethod|null=>value===undefined||value==='card'?'card':value==='pix'?'pix':null;
export const pixEventCanConfirm=(type:string,historicalStatus:unknown)=>type==='checkout.session.async_payment_succeeded'||(type==='checkout.session.completed'&&historicalStatus==='paid');
type PaidSession={id:string;livemode:boolean;mode:string|null;status:string|null;payment_status:string;customer:unknown;payment_intent:unknown;amount_total:number|null;currency:string|null};
type PaidIntent={id:string;livemode:boolean;status:string;customer:unknown;amount:number;amount_received:number;currency:string};
type PaidCharge={id:string;paid:boolean;status:string;currency:string;amount:number;payment_intent:unknown;customer:unknown;payment_method_details:{type:string}|null};
type PaidLine={quantity:number|null;price:{unit_amount:number|null;currency:string;product:unknown;recurring?:unknown}|null};
const id=(v:unknown)=>typeof v==='string'?v:v&&typeof v==='object'&&'id' in v?v.id:null;
export function verifiedPixPayment(order:{session_id:string;customer_id:string;plan:PlanId;first_price_cents:number},session:PaidSession,intent:PaidIntent,charge:PaidCharge,lines:{has_more:boolean;data:PaidLine[]}){
 const expected=order.first_price_cents;
 const validPrice=order.plan==='combo'?[3990,8980].includes(expected):STRIPE_PLANS[order.plan].priceCents===expected;
 if(!validPrice||session.id!==order.session_id||!session.livemode||session.mode!=='payment'||session.status!=='complete'||session.payment_status!=='paid'||id(session.customer)!==order.customer_id||id(session.payment_intent)!==intent.id||session.currency!=='brl'||session.amount_total!==expected)return false;
 if(!intent.livemode||intent.status!=='succeeded'||id(intent.customer)!==order.customer_id||intent.currency!=='brl'||intent.amount!==expected||intent.amount_received!==expected)return false;
 if(!charge.paid||charge.status!=='succeeded'||charge.currency!=='brl'||charge.amount!==expected||id(charge.payment_intent)!==intent.id||id(charge.customer)!==order.customer_id||charge.payment_method_details?.type!=='pix')return false;
 if(lines.has_more||lines.data.length!==1)return false;
 const line=lines.data[0];return line.quantity===1&&line.price?.unit_amount===expected&&line.price.currency==='brl'&&!line.price.recurring&&id(line.price.product)===STRIPE_PLANS[order.plan].product;
}
