import type {PlanId} from './access';
export const purchasePlan=(value:unknown):PlanId|null=>value==='rider'||value==='merchant'||value==='combo'?value:null;
export function purchaseEmail(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const email=value.trim().toLowerCase();
 return email.length<=254&&!email.endsWith('.invalid')&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:null;
}
export function canFulfillPurchase(session:{mode?:string|null;payment_status?:string;status?:string|null;customer?:unknown;subscription?:unknown},customer:string,subscription:string){
 const id=(value:unknown)=>typeof value==='string'?value:value&&typeof value==='object'&&'id' in value?value.id:null;
 return session.mode==='subscription'&&session.payment_status==='paid'&&session.status==='complete'&&id(session.customer)===customer&&id(session.subscription)===subscription;
}
export type PurchaseBuyer={id:string;confirmed:boolean;managed:boolean};
type AccessDelivery={
 readBuyer:()=>Promise<PurchaseBuyer|null>;
 resetUnconfirmed:(id:string)=>Promise<void>;
 invite:()=>Promise<PurchaseBuyer|null>;
 recovery:()=>Promise<void>;
 record:(id:string)=>Promise<void>;
};
export async function deliverBuyerAccess(io:AccessDelivery){
 let buyer=await io.readBuyer();
 if(buyer?.managed)throw new Error('PURCHASE_MANAGED_ACCOUNT');
 if(buyer?.confirmed){await io.recovery();}
 else{
  if(buyer)await io.resetUnconfirmed(buyer.id);
  const invited=await io.invite();
  if(invited)buyer=invited;
  else{buyer=await io.readBuyer();if(!buyer?.confirmed||buyer.managed)throw new Error('PURCHASE_EMAIL_FAILED');await io.recovery();}
 }
 if(!buyer)throw new Error('PURCHASE_EMAIL_FAILED');
 await io.record(buyer.id);
}
