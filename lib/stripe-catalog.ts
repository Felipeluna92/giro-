import type {PlanId} from './access';

export const STRIPE_API_VERSION = '2026-09-30.endive' as const;
export const STRIPE_ACCOUNT = 'acct_1TsnW9RwctN2fxkt';
export const STRIPE_PORTAL_CONFIGURATION = 'bpc_1USNCuRwctN2fxkt0nJA18kc';
export const STRIPE_COMBO_COUPON = 'giro_combo_primeiro_mes_3990';
export const STRIPE_PLANS = {
 rider: {name:'Giro Motoboy', priceCents:2990, product:'giro_rider_monthly', price:'price_1USNBSRwctN2fxktUpjCKc26'},
 merchant: {name:'Giro Comerciante', priceCents:5990, product:'giro_merchant_monthly', price:'price_1USNBiRwctN2fxktjvxhdyeB'},
 combo: {name:'Motoboy + Comerciante', priceCents:8980, product:'giro_combo_monthly', price:'price_1USNBpRwctN2fxktVUMxKtlU'},
} as const;
export const STRIPE_FIRST_MONTH_CENTS = 3990;
export function planForPrice(price:string):PlanId|null {
 return (Object.keys(STRIPE_PLANS) as PlanId[]).find(plan=>STRIPE_PLANS[plan].price===price)??null;
}
export function plansOverlap(left:PlanId,right:PlanId){
 return left===right || (left!=='rider'&&right!=='rider');
}
