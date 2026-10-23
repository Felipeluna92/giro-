'use client';
import {useRef,useState} from 'react';
import {ArrowRight,ArrowUpRight,Bike,Camera,Check,CheckCircle2,ReceiptText,RotateCcw,Store,Wallet} from 'lucide-react';
import type {SalesAudience} from '../lib/sales-content';
import {trackGiro} from '../lib/sales-analytics';
import {DemoMap} from './sales-hero';

const orders=[{id:1042,address:'Rua das Flores, 120',fee:800},{id:1043,address:'Avenida Central, 540',fee:650},{id:1044,address:'Rua do Sol, 88',fee:1000}];
const money=(c:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(c/100);
const names={rider:['Foto','Conferência','Rota','Fechamento'],merchant:['Convite','Equipe','Entregas','Acerto']};
export default function SalesDemo({portal}:{portal:SalesAudience}){
 const [step,setStep]=useState(0);const started=useRef(false);const finished=useRef(false);const titleRef=useRef<HTMLHeadingElement>(null);const rider=portal==='rider';
 const advance=()=>{
  if(!started.current){trackGiro('demo_start',{audience:portal});started.current=true;}
  const next=Math.min(3,step+1);setStep(next);trackGiro('demo_step',{audience:portal,step:next});
  if(next===3&&!finished.current){trackGiro('demo_complete',{audience:portal});finished.current=true;}
  requestAnimationFrame(()=>titleRef.current?.focus({preventScroll:true}));
 };
 const titles=rider?['Pegou a comanda?','A IA sugere. Você confere.','Três paradas, uma sequência.','R$ 24,50. Tudo para conferir.']:['Começa com um convite.','A equipe escolhe se conectar.','Cada entrega tem um status.','Alex: R$ 16,50 a acertar.'];
 const action=rider?['Ler comanda de exemplo','Confirmar e organizar a rota','Simular 3 entregas concluídas']:['Simular convite aceito','Ver entregas da equipe','Conferir o acerto de Alex'];
 return <section className="gs-section gs-demo" id="demo" aria-labelledby="demo-title"><div className="gs-section-heading"><span className="gs-eyebrow">EXPERIMENTE ANTES DE ESCOLHER</span><h2 id="demo-title">Entenda o Giro.<br/><em>Em 3 toques.</em></h2><p>{rider?'Da comanda ao fechamento. Você vê o caminho inteiro.':'Do convite ao acerto. Veja o que muda no seu painel.'}</p></div>
  <div className="gs-demo-layout"><div className="gs-demo-guide"><span className="gs-demo-profile">{rider?<Bike size={19}/>:<Store size={19}/>} Demonstração {rider?'Motoboy':'Comerciante'}</span><ol aria-label="Etapas da demonstração">{names[portal].map((name,i)=><li key={name} className={i===step?'is-current':i<step?'is-done':''} aria-current={i===step?'step':undefined}><span>{i<step?<Check size={16}/>:i+1}</span>{name}</li>)}</ol><p>Dados fictícios. Nenhuma foto, cadastro ou permissão de GPS é solicitada.</p><span className="gs-demo-progress">{Math.min(step,3)} de 3 toques concluídos</span></div>
   <div className="gs-demo-screen"><div className="gs-demo-top"><b>giro<span>.</span></b><span>Simulação · dados fictícios</span></div><div className="gs-demo-content"><h3 ref={titleRef} tabIndex={-1}>{titles[step]}</h3><div className="gs-demo-state" aria-live="polite" aria-atomic="true">
    {step===0&&rider?<div className="gs-demo-receipt"><ReceiptText size={25}/><span>COMANDA #1042 · EXEMPLO</span><b>Cliente de exemplo</b><p>Rua das Flores, 120<br/>Casa · Centro</p><div><span>Pedido</span><b>R$ 48,00</b></div><div><span>Taxa de entrega</span><b>R$ 8,00</b></div><small>Dinheiro do pedido e taxa são valores diferentes.</small></div>
    :step===0?<div className="gs-demo-invite"><span className="gs-cube"><Store size={32}/></span><b>Comércio de exemplo</b><p>Você envia o convite. O motoboy decide se aceita o vínculo.</p><div><Bike size={21}/><span>Alex · conta Motoboy</span><span className="gs-tag neutral">Aguardando convite</span></div></div>
    :step===1&&rider?<div className="gs-demo-review"><span className="gs-tag"><CheckCircle2 size={14}/> Dados sugeridos para revisar</span><dl>{[['Cliente','Cliente de exemplo'],['Endereço','Rua das Flores, 120 · Casa'],['Telefone','(00) 00000-0000 · exemplo'],['Taxa de entrega','R$ 8,00']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}<Check size={16}/></dd></div>)}</dl><p>Na sua conta, confira e corrija os campos antes de salvar. Nada é confirmado sozinho.</p></div>
    :step===1?<div className="gs-demo-accepted"><span className="gs-success"><Check size={33}/></span><b>Convite aceito nesta simulação.</b><div className="gs-demo-person"><span className="gs-avatar">A</span><div><b>Alex</b><small>Conectado ao comércio de exemplo</small></div><CheckCircle2 size={20}/></div><p>O vínculo foi aceito. Compartilhar GPS é outra escolha, feita pelo motoboy durante o turno.</p></div>
    :step===2?<div className="gs-demo-route"><DemoMap merchant={!rider}/><div className="gs-demo-orders">{orders.map((order,i)=><div key={order.id}><span>{i+1}</span><div><b>{order.address}</b><small>#{order.id} · {money(order.fee)} de taxa</small></div>{!rider&&<span className={'gs-tag '+(i===0?'':'neutral')}>{['Em rota','A retirar','Concluída'][i]}</span>}</div>)}</div><p>{rider?'Exemplo com 3 paradas. No plano, organize até 8 por rota.':'Entregas de Alex, separadas por status. Localização ilustrativa.'}</p></div>
    :<div className="gs-demo-result"><span className="gs-success"><Check size={30}/></span><span>3 ENTREGAS CONCLUÍDAS · EXEMPLO</span><strong>{rider?'R$ 24,50':'R$ 16,50'}</strong><p>{rider?'em taxas das entregas concluídas.':'de saldo de taxas a pagar ao Alex.'}</p><div className="gs-demo-equation">R$ 8,00 + R$ 6,50 + R$ 10,00 = <b>R$ 24,50</b></div>{!rider&&<div className="gs-demo-paid">Taxas: R$ 24,50 − já pago: R$ 8,00<br/><b>Saldo a pagar: R$ 16,50</b></div>}<small><Wallet size={15}/> O dinheiro dos pedidos fica separado.</small></div>}
   </div>{step<3?<button type="button" className="gs-button gs-primary gs-demo-next" onClick={advance}>{step===0&&rider?<Camera size={18}/>:null}{action[step]}<ArrowRight size={18}/></button>:<div className="gs-demo-done"><a className="gs-button gs-primary" href={'/comprar?plano='+portal} data-cta-position="demo" data-plan={portal} data-destination="purchase">Gostou? Comece agora <ArrowUpRight size={18}/></a><button type="button" className="gs-text-button" onClick={()=>{setStep(0);requestAnimationFrame(()=>titleRef.current?.focus({preventScroll:true}));}}><RotateCcw size={15}/> Ver de novo</button><p>{rider?'R$ 29,90/mês':'R$ 59,90/mês'} · Cancele a próxima renovação quando quiser.</p></div>}</div></div>
  </div>
 </section>;
}
