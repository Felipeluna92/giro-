import { getRiderUser } from '../../../lib/auth';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 if(!await getRiderUser())return Response.json({error:'Entre para continuar.'},{status:401});
 try{const {address,city}=await req.json() as {address:unknown;city:unknown};if(typeof address!=='string'||address.length<5||address.length>400||typeof city!=='string'||city.length>100)return Response.json({error:'Confira o endereço e a cidade.'},{status:400});
 const url=new URL('https://photon.komoot.io/api/');url.searchParams.set('q',`${address}, ${city}, Brasil`);url.searchParams.set('limit','5');url.searchParams.set('bbox','-74,-34,-34,6');
 const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'GiroMotoboy/1.0 (Giro delivery planner)'}});if(!r.ok)throw new Error('Consulta indisponível');const data=await r.json() as {features:{geometry:{coordinates:[number,number]},properties:Record<string,string>}[]};
 const points=data.features.filter(f=>f.properties.countrycode?.toLowerCase()==='br').map(f=>({lat:f.geometry.coordinates[1],lon:f.geometry.coordinates[0],label:[f.properties.street||f.properties.name,f.properties.housenumber,f.properties.district,f.properties.city||f.properties.town,f.properties.state].filter(Boolean).join(', ')}));
 return Response.json({points},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Não foi possível consultar o mapa agora. Tente novamente ou abra o endereço no Google Maps.'},{status:502});}
}
