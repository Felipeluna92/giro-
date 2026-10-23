import test from 'node:test';
import assert from 'node:assert/strict';
import {feeEquivalent,salesFaq,salesCopy} from '../lib/sales-content.ts';
import {salesStructuredData} from '../lib/sales-seo.ts';
import {safeEventProperties,trackGiro} from '../lib/sales-analytics.ts';

test('Fee comparison uses gross cents and rejects zero, invalid and fractional-cent amounts',()=>{
 assert.equal(feeEquivalent(2990,800),3.7375);
 for(const value of [0,-100,NaN,Infinity,1.5])assert.equal(feeEquivalent(2990,value),null);
 assert.equal(feeEquivalent(0,800),null);
});
test('Analytics accepts only fixed funnel dimensions and excludes personal and checkout identifiers',()=>{
 assert.deepEqual(safeEventProperties({audience:'merchant',plan:'combo',position:'plans',method:'pix',amount_cents:3990,email:'buyer@example.com',phone:'private',address:'private',session_id:'private',url:'private',faq:'private',depth:Infinity}),{audience:'merchant',plan:'combo',position:'plans',method:'pix',amount_cents:3990});
 assert.deepEqual(safeEventProperties({plan:'admin',position:'unexpected',fee_cents:0,step:10}),{});
 assert.doesNotThrow(()=>trackGiro('begin_checkout',{plan:'rider'}));
});
test('Browser tracking respects privacy controls and never leaks unknown properties or query strings',()=>{
 const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
 const originalNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const signals=[];const nav={doNotTrack:'0',globalPrivacyControl:false};
 const win={location:{pathname:'/comprar',search:'?email=private&session_id=private'},dataLayer:[],dispatchEvent:e=>signals.push(e.detail)};
 try{
  Object.defineProperty(globalThis,'window',{value:win,configurable:true});Object.defineProperty(globalThis,'navigator',{value:nav,configurable:true});
  trackGiro('begin_checkout',{plan:'rider',method:'pix',amount_cents:2990,email:'private',session_id:'private'});
  assert.deepEqual(win.dataLayer,[{event:'giro_begin_checkout',page:'/comprar',plan:'rider',method:'pix',amount_cents:2990}]);
  assert.equal(signals.length,1);
  nav.globalPrivacyControl=true;trackGiro('cta_click',{plan:'rider'});assert.equal(win.dataLayer.length,1);
  nav.globalPrivacyControl=false;nav.doNotTrack='1';trackGiro('cta_click',{plan:'rider'});assert.equal(win.dataLayer.length,1);
 }finally{
  if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else delete globalThis.window;
  if(originalNavigator)Object.defineProperty(globalThis,'navigator',originalNavigator);else delete globalThis.navigator;
 }
});
test('Structured offers preserve all three checkout links, exact entry prices, and bundle renewal conditions',()=>{
 const graph=salesStructuredData()['@graph'];const products=graph.filter(x=>x['@type']==='Product');
 assert.deepEqual(products.map(x=>x.offers.price),['29.90','59.90','39.90']);
 assert.deepEqual(products.map(x=>new URL(x.offers.url).searchParams.get('plano')),['rider','merchant','combo']);
 assert.match(products[2].description,/89,80\/mês/);assert.match(products[2].description,/uma vez por conta compradora/);
 assert.equal(JSON.stringify(graph).includes('aggregateRating'),false);
 const faq=graph.find(x=>x['@type']==='FAQPage');assert.equal(faq.mainEntity.length,10);
 assert.deepEqual(faq.mainEntity.map(x=>x.acceptedAnswer.text),salesFaq.map(x=>x.answer));
});
test('Sales copy keeps the AI review, independent rider, and GPS limitations explicit',()=>{
 assert.match(salesCopy.rider.description,/dados conferidos/);assert.match(salesCopy.rider.description,/sem loja vinculada/);
 assert.match(salesFaq.find(x=>x.id==='limites').answer,/40 leituras/);assert.match(salesFaq.find(x=>x.id==='limites').answer,/8 paradas/);
 assert.match(salesFaq.find(x=>x.id==='gps').answer,/90 segundos/);assert.match(salesFaq.find(x=>x.id==='gps').answer,/Giro precisa estar aberto/);
});
