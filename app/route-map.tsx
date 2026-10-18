'use client';
import { useEffect, useRef, useState } from 'react';
import { loadScript } from '../lib/browser';
type Point={lat:number,lon:number};
// Leaflet is loaded only when a route has confirmed geographic coordinates.
export default function RouteMap({origin,points,geometry}:{origin:Point,points:Point[],geometry:[number,number][]}){
 const container=useRef<HTMLDivElement>(null);const [failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;let map:{remove:()=>void}|undefined;
 (async()=>{try{if(!document.getElementById('leaflet-css')){const link=document.createElement('link');link.id='leaflet-css';link.rel='stylesheet';link.href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';document.head.appendChild(link);}await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');if(cancelled||!container.current)return;
 // External map API kept at this boundary; all supplied points are numeric and validated server-side.
 const L=(window as unknown as {L:any}).L;
 const m=L.map(container.current,{scrollWheelZoom:false});map=m;
 L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',maxZoom:19}).addTo(m);
 [origin,...points].forEach((p,i)=>L.marker([p.lat,p.lon],{icon:L.divIcon({className:'map-pin',html:`<span>${i===0?'↗':i}</span>`,iconSize:[32,32]})}).addTo(m));
 const line=geometry.map(([lon,lat])=>[lat,lon]);if(line.length)L.polyline(line,{color:'#3b6d39',weight:5,opacity:.85}).addTo(m);
 m.fitBounds(L.latLngBounds([origin,...points].map(p=>[p.lat,p.lon])),{padding:[40,40],maxZoom:16});
 }catch{if(!cancelled)setFailed(true);}})();return()=>{cancelled=true;map?.remove();};
 },[origin,points,geometry]);
 return <div className="live-map"><div ref={container} className="leaflet-container" aria-label="Mapa da rota calculada"/>{failed&&<div className="map-error">O mapa não carregou. A sequência de paradas continua disponível abaixo.</div>}</div>;
}
