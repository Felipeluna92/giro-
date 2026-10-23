export type GiroEvent = 'page_view'|'cta_click'|'audience_change'|'demo_start'|'demo_step'|'demo_complete'|'calculator_use'|'faq_open'|'scroll_depth'|'view_plans'|'checkout_view'|'checkout_submit'|'begin_checkout'|'purchase_confirmed';
type PropertyValue = string|number|boolean;
const safeStrings:Record<string,readonly string[]>={
 audience:['rider','merchant'],plan:['rider','merchant','combo'],method:['card','pix'],
 position:['nav','hero','pain','comparison','steps','demo','merchant','proof','plans','calculator','fit','onboarding','final','mobile','footer'],
 destination:['purchase','plans','demo','merchant','comparison','steps','onboarding'],
 faq:['mais-um-app','loja','internet','acesso','pacote','cancelamento','ia','limites','gps','privacidade'],
};
const numericBounds:Record<string,[number,number]>={step:[0,3],depth:[25,100],fee_cents:[300,2000],amount_cents:[0,100000]};
export function safeEventProperties(input:Record<string,unknown>){
 const result:Record<string,PropertyValue>={};
 for(const [key,value] of Object.entries(input)){
  if(typeof value==='string'&&safeStrings[key]?.includes(value))result[key]=value;
  const bounds=numericBounds[key];
  if(bounds&&typeof value==='number'&&Number.isFinite(value)&&value>=bounds[0]&&value<=bounds[1])result[key]=value;
 }
 return result;
}

// No SDK, cookies, user identifiers, query strings or network requests are added.
// An approved analytics adapter can consume dataLayer or the giro:analytics event.
// The private paid checkout ledger remains the source of truth for revenue.
export function trackGiro(event:GiroEvent,properties:Record<string,unknown>={}){
 if(typeof window==='undefined')return;
 const nav=navigator as Navigator&{globalPrivacyControl?:boolean};
 if(nav.globalPrivacyControl||nav.doNotTrack==='1')return;
 const payload={event:`giro_${event}`,page:window.location.pathname==='/'?'/conheca':window.location.pathname,...safeEventProperties(properties)};
 const target=window as Window&{dataLayer?:unknown[]};
 try{
  target.dataLayer=target.dataLayer||[];
  if(Array.isArray(target.dataLayer)){
   // Keep a bounded in-memory queue when no analytics adapter is installed.
   if(target.dataLayer.length>=200)target.dataLayer.shift();
   target.dataLayer.push(payload);
  }
  window.dispatchEvent(new CustomEvent('giro:analytics',{detail:payload}));
 }catch{/* Measurement must never interrupt checkout. */}
}
