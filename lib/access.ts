export type Portal='rider'|'merchant';
export type AccountAccess={isAdmin:boolean;rider:boolean;merchant:boolean};
export type PublicPlan={portal:Portal;priceCents:number|null;available:boolean};
export const noAccess:AccountAccess={isAdmin:false,rider:false,merchant:false};
export function accountAccess(value:unknown):AccountAccess{
 if(!value||typeof value!=='object')return {...noAccess};
 const data=value as Record<string,unknown>;
 return {isAdmin:data.isAdmin===true,rider:data.rider===true,merchant:data.merchant===true};
}
export const portalPath=(portal:Portal)=>portal==='merchant'?'/comerciante':'/motoboy';
