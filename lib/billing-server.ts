import 'server-only';
import {createClient as createSupabaseClient} from '@supabase/supabase-js';
import {createClient} from './supabase/server';
import {isSupabaseConfigured,supabaseConfig} from './supabase/config';
import type {PublicPlan} from './access';

export function billingClient(){
 const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!secret)throw new Error('Billing backend unavailable');
 return createSupabaseClient(supabaseConfig().url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function getPublicPlans():Promise<PublicPlan[]>{
 const fallback:PublicPlan[]=[{portal:'rider',priceCents:2990,available:false},{portal:'merchant',priceCents:5990,available:false},{portal:'combo',priceCents:8980,firstPriceCents:3990,available:false}];
 if(!isSupabaseConfigured())return fallback;
 const {data,error}=await (await createClient()).rpc('get_giro_plans');
 if(error||!Array.isArray(data)){console.error('giro_plans_unavailable',{code:error?.code});return fallback;}
 return data.filter((p:PublicPlan)=>p.portal==='rider'||p.portal==='merchant'||p.portal==='combo');
}
