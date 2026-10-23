export type AdminAccountFilter='all'|'paid'|'trial'|'inactive'|'managed'|'admin';
export function adminAccountQuery(params:URLSearchParams){
 const search=(params.get('search')||'').trim();
 const filter=params.get('filter')||'all',page=Number(params.get('page')||1);
 if(search.length>120||!['all','paid','trial','inactive','managed','admin'].includes(filter)||!Number.isInteger(page)||page<1||page>100000)return null;
 return {search,filter:filter as AdminAccountFilter,page};
}
export type AdminAction={action:'trial';email:string;plan:'rider'|'merchant';days:number}|{action:'recovery'|'revoke_trial';userId:string};
export function adminAccountAction(value:unknown):AdminAction|null{
 if(!value||typeof value!=='object')return null;
 const body=value as Record<string,unknown>;
 if(body.action==='trial'){
  if(typeof body.email!=='string')return null;
  const email=body.email.trim().toLowerCase();
  if(email.length>254||email.endsWith('.invalid')||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['rider','merchant'].includes(String(body.plan))||typeof body.days!=='number'||!Number.isInteger(body.days)||body.days<1||body.days>30)return null;
  return {action:'trial' as const,email,plan:body.plan as 'rider'|'merchant',days:body.days};
 }
 if((body.action==='recovery'||body.action==='revoke_trial')&&typeof body.userId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId))return {action:body.action,userId:body.userId};
 return null;
}
export type AdminAccount={id:string;email:string|null;name:string;created_at:string;last_sign_in_at:string|null;confirmed:boolean;admin:boolean;managed:boolean;team_access:boolean;plans:{plan:string;until:string;renewalCancelled:boolean;method:string}[];trial:{plan:string;until:string;active:boolean}|null};
export type AdminAccountData={summary:{accounts:number;emails:number;paid:number;trials:number;managed:number;admins:number};total:number;page:number;users:AdminAccount[];events:{id:string;action:string;created_at:string;email:string|null}[]};
