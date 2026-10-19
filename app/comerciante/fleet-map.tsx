'use client';
import { useEffect,useRef,useState } from 'react';
import { loadScript } from '../../lib/browser';
export type FleetPoint={id:string;name:string;lat:number;lon:number;accuracy:number};
export default function FleetMap({points}:{points:FleetPoint[]}){
 const container=useRef<HTMLDivElement>(null),mapRef=useRef<any>(null),layerRef=useRef<any>(null);
 const [ready,setReady]=useState(false),[error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;
  (async()=>{try{
   if(!document.getElementById('leaflet-css')){const css=document.createElement('link');css.id='leaflet-css';css.rel='stylesheet';css.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(css);}
   await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
   if(cancelled||!container.current)return;
   const L=(window as unknown as {L:any}).L,map=L.map(container.current,{scrollWheelZoom:false});
   mapRef.current=map;layerRef.current=L.layerGroup().addTo(map);
   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',maxZoom:19}).addTo(map);
   setReady(true);
  }catch{if(!cancelled)setError(true);}})();
  return()=>{cancelled=true;mapRef.current?.remove();mapRef.current=null;};
 },[]);
 useEffect(()=>{if(!ready||!mapRef.current)return;
  const L=(window as unknown as {L:any}).L;layerRef.current.clearLayers();
  for(const [index,point] of points.entries()){
   const label=document.createElement('span');label.textContent=point.name;
   L.marker([point.lat,point.lon],{icon:L.divIcon({className:'map-pin',html:`<span>${index+1}</span>`,iconSize:[32,32]})}).bindTooltip(label,{permanent:true,direction:'top',offset:[0,-10]}).addTo(layerRef.current);
   L.circle([point.lat,point.lon],{radius:Math.min(point.accuracy,1000),color:'#6d913c',fillOpacity:.07,weight:1}).addTo(layerRef.current);
  }
  if(points.length)mapRef.current.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lon])),{padding:[50,50],maxZoom:15});
 },[ready,points]);
 return <div className="live-map fleet-map"><div className="leaflet-container" ref={container} aria-label="Mapa das posições compartilhadas pelos motoboys"/>{error&&<div className="map-error">O mapa não carregou. As posições também estão disponíveis nos cartões dos motoboys.</div>}</div>;
}
