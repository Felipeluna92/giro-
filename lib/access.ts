export type Portal='rider'|'merchant';
export type PlanId=Portal|'combo';
export type AccountAccess={isAdmin:boolean;rider:boolean;merchant:boolean;combo:boolean;managedRider:boolean;comboIntroUsed:boolean};
export type PublicPlan={portal:PlanId;priceCents:number|null;firstPriceCents?:number|null;available:boolean};
export const noAccess:AccountAccess={isAdmin:false,rider:false,merchant:false,combo:false,managedRider:false,comboIntroUsed:false};
export function accountAccess(value:unknown):AccountAccess{
 if(!value||typeof value!=='object')return {...noAccess};
 const data=value as Record<string,unknown>;
 return {isAdmin:data.isAdmin===true,rider:data.rider===true,merchant:data.merchant===true,combo:data.combo===true,managedRider:data.managedRider===true,comboIntroUsed:data.comboIntroUsed===true};
}
export const portalPath=(portal:PlanId)=>portal==='combo'?'/comerciante/equipe':portal==='merchant'?'/comerciante':'/motoboy';
