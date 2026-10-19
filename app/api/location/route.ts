import { z } from 'zod';
import { portalSession,portalResponse,portalBody } from '../../../lib/portal-api';
const locationSchema=z.object({linkId:z.string().uuid(),sessionId:z.string().uuid(),lat:z.number().finite().min(-90).max(90),lon:z.number().finite().min(-180).max(180),accuracy:z.number().finite().min(0).max(50000),capturedAt:z.string().datetime()});
export async function POST(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 const body=await portalBody(request);
 if(body?.action==='start'){
  const link=z.string().uuid().safeParse(body.linkId);if(!link.success)return portalResponse({error:'Vínculo inválido.'},400);
  const {data,error}=await session.supabase.rpc('start_rider_location',{p_link:link.data});
  return error?portalResponse({error:'Inicie seu turno e confira o vínculo antes de compartilhar.'},400):portalResponse({sessionId:data});
 }
 const parsed=locationSchema.safeParse(body);
 if(!parsed.success)return portalResponse({error:'Localização inválida.'},400);
 const p=parsed.data;
 const {error}=await session.supabase.rpc('share_rider_location',{p_link:p.linkId,p_session:p.sessionId,p_lat:p.lat,p_lon:p.lon,p_accuracy:p.accuracy,p_captured:p.capturedAt});
 if(error)return portalResponse({error:'Não foi possível compartilhar. Confira o vínculo e inicie seu turno.'},400);
 return portalResponse({success:true});
}
export async function DELETE(request:Request){
 const session=await portalSession(request);if(session.error)return session.error;
 const {error}=await session.supabase.rpc('stop_rider_location');
 return error?portalResponse({error:'Não foi possível encerrar o compartilhamento. A posição expira automaticamente.'},503):portalResponse({success:true});
}
