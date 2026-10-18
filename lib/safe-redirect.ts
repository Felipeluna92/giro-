export function safeReturnPath(value:string|null,fallback='/'){
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return fallback;
 try{const parsed=new URL(value,'https://giro.local');return parsed.origin==='https://giro.local'?parsed.pathname+parsed.search+parsed.hash:fallback;}catch{return fallback;}
}
