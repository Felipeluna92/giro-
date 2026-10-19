'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {Store,MapPin,Unlink,Radio,AlertCircle,CheckCircle2} from 'lucide-react';
import type { Place } from '../lib/domain';
import type { RiderLink } from '../lib/merchant';

export default function RiderNetwork({places,name,active,demo}:{places:Place[];name:string;active:boolean;demo:boolean}){
 const [links,setLinks]=useState<RiderLink[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[sharing,setSharing]=useState(''),[selected,setSelected]=useState('');
 const watch=useRef<number|null>(null),heartbeat=useRef<ReturnType<typeof setInterval>|null>(null),latest=useRef<GeolocationPosition|null>(null),sharingRef=useRef(''),lastSent=useRef(0),inFlight=useRef(false),request=useRef<AbortController|null>(null),generation=useRef(0),sessionId=useRef(''),canShare=useRef(active&&!demo);
 canShare.current=active&&!demo;
 const load=useCallback(async()=>{if(demo){setLinks([]);return;}try{const response=await fetch('/api/network',{cache:'no-store'}),data=await response.json();if(!response.ok)throw new Error(data.error);setLinks(data.links);}catch(e){setError((e as Error).message);}},[demo]);
 useEffect(()=>{void load();},[load]);
 const clearWatch=useCallback(()=>{generation.current++;sharingRef.current='';sessionId.current='';if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;if(heartbeat.current)clearInterval(heartbeat.current);heartbeat.current=null;latest.current=null;request.current?.abort();request.current=null;inFlight.current=false;},[]);
 const stop=useCallback(async()=>{clearWatch();setSharing('');try{const response=await fetch('/api/location',{method:'DELETE',keepalive:true});if(!response.ok)throw new Error('A posição anterior pode aparecer por até 90 segundos. O envio de novas posições já foi interrompido.');}catch(e){setError((e as Error).message);}},[clearWatch]);
 useEffect(()=>{if((!active||demo)&&sharingRef.current)void stop();},[active,demo,stop]);
 useEffect(()=>{const hide=()=>{if(!sharingRef.current)return;clearWatch();setSharing('');void fetch('/api/location',{method:'DELETE',keepalive:true}).catch(()=>{});};window.addEventListener('pagehide',hide);return()=>{window.removeEventListener('pagehide',hide);if(sharingRef.current){clearWatch();void fetch('/api/location',{method:'DELETE',keepalive:true}).catch(()=>{});}};},[clearWatch]);

 async function transmit(force=false){
  const position=latest.current,linkId=sharingRef.current,now=Date.now();
  if(!position||!linkId||inFlight.current||now-position.timestamp>60000||(!force&&now-lastSent.current<10000))return;
  const version=generation.current;inFlight.current=true;request.current=new AbortController();
  try{
   const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},signal:request.current.signal,body:JSON.stringify({linkId,sessionId:sessionId.current,lat:position.coords.latitude,lon:position.coords.longitude,accuracy:position.coords.accuracy,capturedAt:new Date(position.timestamp).toISOString()})});
   const data=await response.json();if(version!==generation.current)return;
   if(!response.ok)throw new Error(data.error||'Não foi possível enviar a localização.');
   lastSent.current=Date.now();setNotice('Localização enviada ao comércio selecionado.');setError('');
  }catch(e){if(version===generation.current)setError((e as Error).message);}finally{if(version===generation.current){inFlight.current=false;request.current=null;}}
 }
 async function start(){
  if(!active||demo)return;
  const linkId=links.find(link=>link.id===selected)?.id||links[0]?.id;if(!linkId){setError('Conecte um comércio antes de compartilhar.');return;}
  if(!navigator.geolocation){setError('Este aparelho não disponibilizou localização.');return;}
  clearWatch();setError('');setBusy(true);setNotice('Preparando o compartilhamento…');const version=generation.current;
  try{
   const response=await fetch('/api/location',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',linkId})}),data=await response.json();
   if(version!==generation.current)return;
   if(!response.ok)throw new Error(data.error||'Não foi possível iniciar o compartilhamento.');
   if(!canShare.current){void stop();return;}
   sessionId.current=data.sessionId;
  }catch(e){if(version===generation.current)setError((e as Error).message);return;}finally{setBusy(false);}
  setNotice('Aguardando a permissão e uma posição do GPS…');lastSent.current=0;sharingRef.current=linkId;setSharing(linkId);
  watch.current=navigator.geolocation.watchPosition(position=>{latest.current=position;void transmit();},geoError=>{setError(geoError.code===1?'Permita a localização no navegador para compartilhar com o comércio.':'O GPS não conseguiu atualizar sua posição. A última posição expira automaticamente.');if(geoError.code===1)void stop();},{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  heartbeat.current=setInterval(()=>void transmit(true),20000);
 }
 async function connect(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=event.currentTarget,values=new FormData(form);setBusy(true);setError('');setNotice('');
  try{const response=await fetch('/api/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'connect',code:String(values.get('code')).trim(),placeId:String(values.get('placeId')),name:String(values.get('riderName')).trim(),consent:values.get('consent')==='on'})}),data=await response.json();if(!response.ok)throw new Error(data.error);form.reset();await load();setNotice('Vínculo confirmado com '+data.merchantName+'.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function disconnect(link:RiderLink){if(!window.confirm('Desvincular '+link.merchantName+'? Ele deixará de ver suas entregas e sua localização.'))return;setBusy(true);setError('');try{if(sharingRef.current===link.id)await stop();const response=await fetch('/api/network',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'disconnect',linkId:link.id})}),data=await response.json();if(!response.ok)throw new Error(data.error);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="panel rider-network"><div className="panel-head"><div><h2><Store size={19}/> Meu comércio</h2><p>Vincule o local onde trabalha e escolha quando compartilhar sua posição.</p></div><a className="small-button" href="/comerciante">Área do comerciante</a></div><div className="rider-network-body">
  {demo?<div className="info-note"><AlertCircle size={18}/> Vínculos e GPS ficam desativados na demonstração.</div>:<>
   {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="network-notice" role="status"><CheckCircle2 size={16}/>{notice}</p>}
   {links.length>0&&<div className="rider-links">{links.map(link=><div className="rider-link" key={link.id}><Store size={20}/><div><strong>{link.merchantName}</strong><span>{places.find(p=>p.id===link.placeId)?.name||'Estabelecimento vinculado'}</span></div><button className="icon-button" disabled={busy} aria-label={'Desvincular '+link.merchantName} onClick={()=>void disconnect(link)}><Unlink size={16}/></button></div>)}</div>}
   <div className="rider-sharing"><div><Radio size={22}/><div><h3>{sharing?'Compartilhando localização':'Compartilhe durante o turno'}</h3><p>{sharing?'Somente o comércio selecionado recebe sua posição. Você pode parar a qualquer momento.':'Ative apenas quando estiver trabalhando para o comércio escolhido.'}</p></div></div>{links.length>0&&<label className="field"><span>Comércio que receberá a localização</span><select value={links.find(link=>link.id===selected)?.id||links[0]?.id||''} disabled={!!sharing} onChange={e=>setSelected(e.target.value)}>{links.map(link=><option value={link.id} key={link.id}>{link.merchantName}</option>)}</select></label>}{sharing?<button className="button secondary" onClick={()=>void stop()}><MapPin size={16}/> Parar compartilhamento</button>:<button className="button primary" disabled={busy||!active||!links.length} onClick={()=>void start()}><MapPin size={16}/> Compartilhar localização</button>}{!active&&<small>Inicie seu turno para ativar o compartilhamento.</small>}<p className="service-note">Mantenha o Giro aberto e permita o GPS. O celular pode interromper atualizações em segundo plano. O compartilhamento para ao encerrar o turno ou sair desta tela; posições sem atualização expiram em até 90 segundos.</p></div>
   <details className="connect-merchant" open={!links.length}><summary>Conectar um comércio com código</summary><form onSubmit={connect}><div className="form-grid"><label className="field wide"><span>Código fornecido pelo comerciante</span><input name="code" required minLength={32} maxLength={128} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="Cole o código de vínculo"/></label><label className="field"><span>Estabelecimento que será compartilhado</span><select name="placeId" required defaultValue=""><option value="" disabled>Selecione o estabelecimento</option>{places.filter(place=>!links.some(link=>link.placeId===place.id)).map(place=><option key={place.id} value={place.id}>{place.name}</option>)}</select></label><label className="field"><span>Seu nome para o comércio</span><input name="riderName" required maxLength={80} defaultValue={name} placeholder="Como quer ser identificado?"/></label></div>{!places.length&&<p className="service-note">Cadastre primeiro o estabelecimento no Giro, na aba Estabelecimentos.</p>}<label className="checkbox-field"><input type="checkbox" name="consent" required/> Autorizo este comércio a ver as entregas e os acertos do estabelecimento selecionado, incluindo o histórico. A localização depende de ativação separada.</label><button className="button primary" disabled={busy||!places.length}>Confirmar vínculo</button></form></details>
  </>}
 </div></section>;
}
