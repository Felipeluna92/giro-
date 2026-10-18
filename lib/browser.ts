'use client';
const pending = new Map<string,Promise<void>>();
export function loadScript(src:string){if(pending.has(src))return pending.get(src)!;const promise=new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=true;s.onload=()=>resolve();s.onerror=()=>{pending.delete(src);s.remove();reject(new Error('Não foi possível carregar este recurso. Confira sua conexão e tente novamente.'));};document.head.appendChild(s);});pending.set(src,promise);return promise;}
export type OCRWorker={recognize:(image:File)=>Promise<{data:{text:string,confidence:number}}>,terminate:()=>Promise<void>};
export async function makeOCR(logger:(m:{status:string,progress:number})=>void):Promise<OCRWorker>{await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');return (window as unknown as {Tesseract:{createWorker:(lang:string,oem:number,options:unknown)=>Promise<OCRWorker>}}).Tesseract.createWorker('por',1,{logger});}
