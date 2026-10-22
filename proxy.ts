import { createServerClient } from '@supabase/ssr';
import { NextResponse,type NextRequest } from 'next/server';
import {ATTRIBUTION_COOKIE,ATTRIBUTION_TTL,attributionFromSearch,encodeAttribution} from './lib/attribution';
import { isSupabaseConfigured,supabaseConfig } from './lib/supabase/config';
export async function proxy(request:NextRequest){
 let response=NextResponse.next({request});
 const isPage=(request.method==='GET'||request.method==='HEAD')&&!request.nextUrl.pathname.startsWith('/api/')&&!request.nextUrl.pathname.startsWith('/auth/')&&!request.headers.has('next-router-prefetch');
 const incoming=isPage?attributionFromSearch(request.nextUrl.searchParams):{};
 const optedOut=request.headers.get('sec-gpc')==='1';
 const attribution=!optedOut&&Object.keys(incoming).length?encodeAttribution(incoming):null;
 const finish=()=>{
  if(optedOut)response.cookies.delete(ATTRIBUTION_COOKIE);
  else if(attribution)response.cookies.set(ATTRIBUTION_COOKIE,attribution,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:ATTRIBUTION_TTL});
  // Campaign cookies and authenticated responses must never be cached publicly.
  response.headers.set('Cache-Control','private, no-store');
  return response;
 };
 if(!isSupabaseConfigured())return finish();
 const {url,key}=supabaseConfig();
 const supabase=createServerClient(url,key,{cookies:{getAll:()=>request.cookies.getAll(),setAll:(items,headers)=>{items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));Object.entries(headers||{}).forEach(([name,value])=>response.headers.set(name,value));}}});
 await supabase.auth.getClaims();
 return finish();
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
