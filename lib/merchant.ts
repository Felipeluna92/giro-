export type MerchantLocation = {lat:number;lon:number;accuracy:number;capturedAt:string;updatedAt:string;expiresAt:string};
export type MerchantRider = {id:string;name:string;pending:number;completedToday:number;feesToday:number;due:number;cashDue:number;location:MerchantLocation|null};
export type MerchantDelivery = {id:string;linkId:string;riderName:string;order:string;customer:string;address:string;fee:number;orderTotal:number;payment:string;status:'pending'|'delivered'|'cancelled';day:string;departedAt:string|null;completedAt:string|null};
export type MerchantWorkspace = {profile:{name:string;address:string}|null;riders:MerchantRider[];deliveries:MerchantDelivery[];serverTime:string};
export type RiderLink = {id:string;merchantName:string;placeId:string;riderName:string};

export function deliveryStage(delivery:Pick<MerchantDelivery,'status'|'departedAt'>) {
  return delivery.status==='delivered'?'Entregue':delivery.status==='cancelled'?'Cancelada':delivery.departedAt?'Em rota':'Aguardando retirada';
}
export function liveLocation(location:MerchantLocation|null,now=Date.now()) {
  if(!location)return null;
  const captured=Date.parse(location.capturedAt),expires=Date.parse(location.expiresAt);
  return Number.isFinite(captured)&&Number.isFinite(expires)&&expires>now&&captured<=now+10000&&now-captured<150000?location:null;
}
export function merchantTotals(riders:MerchantRider[]) {
  return riders.reduce((total,rider)=>({pending:total.pending+rider.pending,completed:total.completed+rider.completedToday,fees:total.fees+rider.feesToday,due:total.due+Math.max(0,rider.due),cash:total.cash+Math.max(0,rider.cashDue)}),{pending:0,completed:0,fees:0,due:0,cash:0});
}
