import { z } from 'zod';
export const dayKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit' }).format(date);
const cents = z.number().int().min(0).max(100000000);
const short = z.string().max(300);
export const placeSchema = z.object({ id:z.string().uuid(), name:z.string().min(1).max(100), address:short, rule:z.enum(['full','fixed','percent']), rate:cents });
export const deliverySchema = z.object({
  id:z.string().uuid(), placeId:z.string().uuid(), order: z.string().max(60), customer:short, phone:z.string().max(30), address:z.string().min(5).max(400), complement:short, notes:z.string().max(1500),
  customerFee:cents, earnings:cents, orderTotal:cents, payment:z.enum(['paid','cash','card','pix']), cashCollected:cents, retained:cents, tip:cents,
  status:z.enum(['pending','delivered','cancelled']), createdAt:z.string().datetime(), completedAt:z.string().datetime().nullable(), day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  point:z.object({lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180),label:short}).nullable(), priority:z.boolean(),
}).superRefine((d,ctx)=>{ if(d.retained > d.cashCollected || d.retained > d.earnings) ctx.addIssue({code:'custom',message:'O valor retido não pode superar o dinheiro recebido ou seu ganho.'}); });
export const movementSchema = z.object({id:z.string().uuid(), day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/), kind:z.enum(['expense','extra','payout','remittance']), amount:cents, description:z.string().min(1).max(200), placeId:z.string().uuid().nullable()});
export const stateSchema = z.object({
  deliveries:z.array(deliverySchema).max(3000), places:z.array(placeSchema).max(100), movements:z.array(movementSchema).max(3000),
  preferences:z.object({name:z.string().max(80),city:z.string().max(100),goal:cents,activeSince:z.string().datetime().nullable()}),
}).superRefine((s,ctx)=>{
  const ids=new Set(s.places.map(p=>p.id));
  for(const d of s.deliveries) if(!ids.has(d.placeId)) ctx.addIssue({code:'custom',message:'Estabelecimento da entrega não encontrado.'});
  for(const m of s.movements) if((m.kind==='payout'||m.kind==='remittance')&&(!m.placeId||!ids.has(m.placeId))) ctx.addIssue({code:'custom',message:'Selecione o estabelecimento do acerto.'});
  for(const items of [s.deliveries,s.places,s.movements]) if(new Set(items.map(i=>i.id)).size!==items.length) ctx.addIssue({code:'custom',message:'Há registros duplicados.'});
});
export type RiderState=z.infer<typeof stateSchema>;
export type Delivery=z.infer<typeof deliverySchema>;
export type Place=z.infer<typeof placeSchema>;
export type Movement=z.infer<typeof movementSchema>;
export const emptyState = ():RiderState=>({deliveries:[],places:[],movements:[],preferences:{name:'',city:'',goal:15000,activeSince:null}});
export const money = (c:number)=> new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
export function parseMoney(input:string){
 const s=input.trim().replace(/R\$\s*/gi,'').replace(/\s/g,'');if(!s)return 0;
 let normalized:string;
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s))normalized=s.replace(/\./g,'').replace(',','.');
 else if(/^\d+(?:,\d{1,2})?$/.test(s))normalized=s.replace(',','.');
 else if(/^\d+\.\d{1,2}$/.test(s))normalized=s;
 else throw new Error('Informe um valor válido, como 10,50.');
 const n=Number(normalized);if(!Number.isFinite(n)||n>1000000)throw new Error('Informe um valor de até R$ 1.000.000,00.');return Math.round(n*100);
}
export function feeFor(place:Place|undefined,customerFee:number){return !place||place.rule==='full'?customerFee:place.rule==='fixed'?place.rate:Math.round(customerFee*place.rate/10000);}
export function summarize(state:RiderState, day:string){
 const ds=state.deliveries.filter(d=>d.day===day&&d.status==='delivered');const ms=state.movements.filter(m=>m.day===day);
 const fees=ds.reduce((s,d)=>s+d.earnings,0), tips=ds.reduce((s,d)=>s+d.tip,0), extra=ms.filter(m=>m.kind==='extra').reduce((s,m)=>s+m.amount,0), expenses=ms.filter(m=>m.kind==='expense').reduce((s,m)=>s+m.amount,0);
 return {count:ds.length,fees,tips,extra,expenses,gross:fees+tips+extra,net:fees+tips+extra-expenses};
}
export function balances(state:RiderState, placeId:string){const ds=state.deliveries.filter(d=>d.placeId===placeId&&d.status==='delivered');const ms=state.movements.filter(m=>m.placeId===placeId);return {due:ds.reduce((s,d)=>s+d.earnings-d.retained,0)-ms.filter(m=>m.kind==='payout').reduce((s,m)=>s+m.amount,0),cash:ds.reduce((s,d)=>s+d.cashCollected-d.retained,0)-ms.filter(m=>m.kind==='remittance').reduce((s,m)=>s+m.amount,0)};}
export function extractReceipt(text:string){
 const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);const phone=text.match(/(?:\+?55\s*)?\(?\d{2}\)?[\s.-]*9?\d{4}[\s.-]*\d{4}/)?.[0]||'';
 const value=(pattern:RegExp)=>{const l=lines.find(l=>pattern.test(l));const match=l?.match(/(?:R\$\s*)?(\d{1,6}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/);return match?parseMoney(match[1]):0;};
 const address=lines.find(l=>/^(?:endere[cç]o\s*[:\-]?\s*)?(?:rua\b|r\.|avenida\b|av\.|travessa\b|alameda\b|estrada\b|rodovia\b|pra[cç]a\b)/i.test(l))||lines.find(l=>/^endere[cç]o\s*:/i.test(l))||'';
 const labelled=(p:RegExp)=>lines.find(l=>p.test(l))?.replace(p,'').trim()||'';
 return {customer:labelled(/^(?:cliente|nome)\s*[:\-]\s*/i),phone,address:address.replace(/^endere[cç]o\s*[:\-]?\s*/i,''),order:labelled(/^(?:pedido|comanda)\s*[:#\-]?\s*/i),customerFee:value(/(?:taxa.*entrega|entrega.*taxa|taxa de entrega|^entrega\s*[:R$])/i),orderTotal:value(/(?:total\s*(?:do pedido|a pagar)?\s*[:R$]|valor total)/i),notes:labelled(/^(?:obs\.?|observa[cç][oõ]es)\s*[:\-]\s*/i)};
}
export function optimizeOrder(durations:(number|null)[][], count:number):number[]{
 // Exact open-path optimization with a fixed starting point, up to 8 deliveries.
 const size=1<<count, dp=Array.from({length:size},()=>Array(count).fill(Infinity)), prev=Array.from({length:size},()=>Array(count).fill(-1));
 for(let i=0;i<count;i++)dp[1<<i][i]=durations[0]?.[i+1]??Infinity;
 for(let mask=1;mask<size;mask++)for(let last=0;last<count;last++)if(mask&(1<<last))for(let next=0;next<count;next++)if(!(mask&(1<<next))){const m=mask|(1<<next),v=dp[mask][last]+(durations[last+1]?.[next+1]??Infinity);if(v<dp[m][next]){dp[m][next]=v;prev[m][next]=last;}}
 let mask=size-1,last=dp[mask].indexOf(Math.min(...dp[mask]));if(!Number.isFinite(dp[mask][last]))throw new Error('Não foi possível encontrar uma rota entre essas paradas.');const order:number[]=[];while(last>=0){order.unshift(last);const p=prev[mask][last];mask^=1<<last;last=p;}return order;
}
