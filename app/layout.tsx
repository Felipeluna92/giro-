import type { Metadata } from 'next';
import './globals.css';
import './merchant.css';
import './sales.css';
import './sales-v2.css';
import './purchase.css';
import AuthHashRedirect from './auth-hash-redirect';
export const metadata:Metadata={title:'Giro — seu turno no controle',description:'Comandas por foto, entregas organizadas e seus ganhos na palma da mão.',icons:{icon:'/favicon.svg'},manifest:'/manifest.webmanifest'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><AuthHashRedirect/>{children}</body></html>}
