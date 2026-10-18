import { getRiderUser } from '../../../lib/auth';
import { optimizeOrder } from '../../../lib/domain';
import { z } from 'zod';
const point=z.object({lat:z.number().min(-90).max(90),lon:z.number().min(-180).max(180)});
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!await getRiderUser())return Response.json({error:'Entre para continuar.'},{status:401});
 try{const input=z.object({origin:point,points:z.array(point).min(1).max(8),optimize:z.boolean()}).safeParse(await req.json());if(!input.success)return Response.json({error:'Selecione de 1 a 8 entregas com localização confirmada.'},{status:400});
 const {origin,points,optimize}=input.data;const coords=[origin,...points].map(p=>`${p.lon},${p.lat}`).join(';');
 let order=points.map((_,i)=>i);
 if(optimize){const t=await fetch(`https://router.project-osrm.org/table/v1/driving/${coords}?annotations=duration`,{signal:AbortSignal.timeout(15000)});if(!t.ok)throw new Error();const table=await t.json() as {code:string,durations:(number|null)[][]};if(table.code!=='Ok')throw new Error();order=optimizeOrder(table.durations,points.length);}
 const sorted=[origin,...order.map(i=>points[i])].map(p=>`${p.lon},${p.lat}`).join(';');const r=await fetch(`https://router.project-osrm.org/route/v1/driving/${sorted}?overview=full&geometries=geojson`,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();const data=await r.json() as {code:string,routes:{distance:number,duration:number,geometry:{coordinates:[number,number][]}}[]};if(data.code!=='Ok'||!data.routes?.length)throw new Error();
 return Response.json({order,distance:data.routes[0].distance,duration:data.routes[0].duration,geometry:data.routes[0].geometry.coordinates},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'O serviço de rotas não respondeu. Você pode continuar navegando uma entrega por vez.'},{status:502});}
}
