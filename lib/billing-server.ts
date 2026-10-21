import 'server-only';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
import {supabaseConfig} from './supabase/config';
import type {PublicPlan} from './access';
import {STRIPE_PLANS,STRIPE_FIRST_MONTH_CENTS,STRIPE_ACCOUNT} from './stripe-catalog';

export function billingClient(){
 const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)throw new Error('Billing backend unavailable');
 return createSupabaseClient(supabaseConfig().url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getPublicPlans():Promise<PublicPlan[]>{
 const available=/^(rk|sk)_live_/.test(process.env.STRIPE_SECRET_KEY||'')&&!!process.env.STRIPE_WEBHOOK_SECRET&&process.env.STRIPE_ACCOUNT_ID===STRIPE_ACCOUNT;
 return (Object.entries(STRIPE_PLANS) as [PublicPlan['portal'],typeof STRIPE_PLANS[keyof typeof STRIPE_PLANS]][]).map(([portal,plan])=>({portal,priceCents:plan.priceCents,firstPriceCents:portal==='combo'?STRIPE_FIRST_MONTH_CENTS:null,available}));
}
