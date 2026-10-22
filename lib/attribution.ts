// Campaign labels are analytics only; never use them for billing or authorization.
export const ATTRIBUTION_COOKIE='giro_attribution';
export const ATTRIBUTION_TTL=7*24*60*60;
export const ATTRIBUTION_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck'] as const;
export type Attribution=Partial<Record<typeof ATTRIBUTION_KEYS[number],string>>;
export function sanitizeAttribution(input:unknown):Attribution{
 if(!input||typeof input!=='object'||Array.isArray(input))return {};
 const result:Attribution={};
 for(const key of ATTRIBUTION_KEYS){
  const raw=(input as Record<string,unknown>)[key];
  if(typeof raw!=='string')continue;
  const value=raw.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,120);
  if(value)result[key]=value;
 }
 return result;
}
export function attributionFromSearch(search:URLSearchParams):Attribution{
 return sanitizeAttribution(Object.fromEntries(ATTRIBUTION_KEYS.map(key=>[key,search.get(key)])));
}
export function encodeAttribution(value:Attribution,now=Date.now()):string{
 const data=sanitizeAttribution(value);
 let encoded=Buffer.from(JSON.stringify({at:now,data})).toString('base64url');
 if(encoded.length>3000){for(const key of ATTRIBUTION_KEYS)if(data[key])data[key]=data[key]!.slice(0,40);encoded=Buffer.from(JSON.stringify({at:now,data})).toString('base64url');}
 return encoded;
}
export function decodeAttribution(value:string|undefined,now=Date.now()):Attribution{
 if(!value||value.length>3200)return {};
 try{
  const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
  if(!Number.isFinite(parsed.at)||parsed.at>now+60000||now-parsed.at>ATTRIBUTION_TTL*1000)return {};
  return sanitizeAttribution(parsed.data);
 }catch{return {};}
}
// Same encoding used by UTMify's official Stripe script, inspected 2026-10-22:
// https://cdn.utmify.com.br/scripts/utms/latest.js (addStripeClientReferenceIdIfNeeded).
export function utmifyClientReference(input:Attribution):string|undefined{
 const values=sanitizeAttribution(input);
 const clean=(value:string|undefined)=>{const first=(value||'').split('::')[0];return (first.includes('|')?first.slice(first.lastIndexOf('|')+1):first).replace(/[^A-Za-z0-9_-]/g,'');};
 const parts=[clean(values.utm_source),clean(values.utm_medium),clean(values.utm_campaign),clean(values.utm_content),clean(values.utm_term)];
 return parts.some(Boolean)?parts.join('__').slice(0,200):undefined;
}
