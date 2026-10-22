'use client';
import {useEffect} from 'react';
// Auth can fall back to Site URL if an email redirect is not yet allowlisted.
// Fragments remain in the browser and are never sent to the server or analytics.
export default function AuthHashRedirect(){useEffect(()=>{if(['/definir-senha','/redefinir-senha'].includes(window.location.pathname))return;const hash=new URLSearchParams(window.location.hash.slice(1));if(hash.has('access_token')&&hash.has('refresh_token')&&['invite','recovery'].includes(hash.get('type')||''))window.location.replace('/definir-senha'+window.location.hash);},[]);return null;}
