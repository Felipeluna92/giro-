import {useId} from 'react';
import {ArrowUpRight,Bike,Camera,Check,MapPin,Navigation,ReceiptText,Route,ShieldCheck,Store,Wallet} from 'lucide-react';
import type {SalesAudience} from '../lib/sales-content';

export function DemoMap({merchant=false}:{merchant?:boolean}){
 const id=useId();
 return <div className="gs-map" role="img" aria-label={merchant?'Mapa ilustrativo com a última localização autorizada de Alex. Dados fictícios.':'Rota ilustrativa com três paradas. Dados fictícios.'}>
  <svg viewBox="0 0 480 210" aria-hidden="true"><defs><pattern id={id} width="66" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(-16)"><rect x="6" y="6" width="50" height="42" rx="9" fill="#dce5d4"/><path d="M0 0H66V60" fill="none" stroke="#fffdf8" strokeWidth="12"/></pattern></defs><rect width="480" height="210" fill="#edf1e8"/><rect width="480" height="210" fill={`url(#${id})`}/><path d="M-15 188Q110 94 240 148T500 66" fill="none" stroke="#c1dce1" strokeWidth="23"/><path d="M70 151L147 98L224 122L308 57L397 82" fill="none" stroke="#38533c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>{[[70,151],[224,122],[397,82]].map(([x,y],i)=><g key={i} transform={`translate(${x},${y})`}><circle r="17" fill={i===0?'#193b2c':'#c8f477'} stroke="white" strokeWidth="4"/><text y="5" textAnchor="middle" fontSize="13" fontWeight="700" fill={i===0?'white':'#193b2c'}>{i+1}</text></g>)}{merchant&&<g transform="translate(308 57)"><circle r="29" fill="#7b65bc25"/><circle r="10" fill="#6b4fb5" stroke="white" strokeWidth="4"/></g>}</svg>
  <span className="gs-map-label"><Navigation size={12}/>{merchant?'Posição autorizada · exemplo':'3 paradas · exemplo'}</span>
 </div>;
}

export function MerchantDashboard({compact=false}:{compact?:boolean}){
 return <div className={'gs-dashboard'+(compact?' is-compact':'')}>
  <div className="gs-dashboard-top"><span className="gs-mini-brand"><ArrowUpRight size={18}/> giro.</span><span><Store size={13}/> Comércio de exemplo</span></div>
  <div className="gs-dashboard-heading"><div><span>VISÃO DO TURNO</span><p className="gs-dashboard-title">Cada motoboy. Cada acerto.</p></div><span className="gs-status-dot">Equipe conectada</span></div>
  <div className="gs-dashboard-stats"><div><span>Motoboys conectados</span><b>3</b></div><div><span>Saldo de taxas a pagar</span><b>R$ 54,50</b></div></div>
  <DemoMap merchant/>
  <div className="gs-team-table"><div className="gs-team-header"><span>Motoboy / entrega</span><span>Saldo a pagar</span></div>{[['A','Alex','Em rota','16,50'],['D','Dani','Aguardando retirada','20,00'],['R','Rafa','Concluída','18,00']].map(([initial,name,status,amount])=><div className="gs-team-row" key={name}><span className={'gs-avatar avatar-'+initial}>{initial}</span><div><b>{name}</b><small>{status}</small></div><strong>R$ {amount}</strong></div>)}</div>
  <div className="gs-dashboard-foot"><ShieldCheck size={14}/> Só a última posição autorizada no turno.</div>
 </div>;
}

export default function SalesHero({portal}:{portal:SalesAudience}){
 if(portal==='merchant')return <figure className="gs-hero-scene merchant-scene" aria-label="Painel ilustrativo de comerciante com três motoboys e saldo de taxas de R$ 54,50. Todos os dados são fictícios."><div className="gs-stage-number" aria-hidden="true">NO<br/>CONTROLE.</div><MerchantDashboard compact/><div className="gs-scene-stamp"><Wallet size={19}/><span>Taxas de cada um.<br/><b>Acerto sem conta de cabeça.</b></span></div><figcaption>Interface ilustrativa · equipe, localização e valores fictícios.</figcaption></figure>;
 return <figure className="gs-hero-scene rider-scene" aria-label="Celular ilustrativo com três entregas, rota e R$ 24,50 em taxas. Todos os dados são fictícios.">
  <div className="gs-stage-number" aria-hidden="true">SEU<br/>CORRE.</div>
  <div className="gs-receipt-float"><ReceiptText size={19}/><span>COMANDA #1042</span><div>Taxa de entrega<strong>R$ 8,00</strong></div><small><Check size={12}/> Conferida antes de salvar</small></div>
  <div className="gs-phone"><div className="gs-phone-hardware"><span>17:42</span><i/><span>▰</span></div><div className="gs-phone-body"><div className="gs-phone-brand"><b>giro<span>.</span></b><span>MEU TURNO</span></div><div className="gs-phone-greeting">Bora, Alex <span>✦</span><strong className="gs-phone-title">Seu corre, no controle.</strong></div><div className="gs-phone-balance"><span>Taxas de 3 entregas concluídas</span><strong>R$ 24<span>,50</span></strong><Wallet size={25}/></div><div className="gs-phone-map-title"><Route size={14}/> Próximas paradas <span>3</span></div><DemoMap/><div className="gs-phone-order"><span><MapPin size={17}/></span><div><small>PRÓXIMA ENTREGA · #1042</small><b>Rua das Flores, 120</b><small>Endereço de exemplo</small></div></div><div className="gs-phone-bottom"><Bike size={17}/><Route size={17}/><span><Camera size={20}/></span><Wallet size={17}/><Store size={17}/></div></div></div>
  <div className="gs-scene-stamp"><span className="gs-cube"><Wallet size={25}/></span><span>Cada taxa no seu lugar.<br/><b>Seu fechamento também.</b></span></div>
  <figcaption>Interface ilustrativa · endereços e valores fictícios.</figcaption>
 </figure>;
}
