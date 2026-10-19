import type { Metadata } from 'next';
import './globals.css';
import './merchant.css';
export const metadata:Metadata={title:'Giro — seu turno no controle',description:'Comandas por foto, entregas organizadas e seus ganhos na palma da mão.',icons:{icon:'/favicon.svg'},manifest:'/manifest.webmanifest'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
