import type {Metadata} from 'next';
import DefinePassword from './password-form';
import {isSupabaseConfigured} from '../../lib/supabase/config';
export const metadata:Metadata={title:'Defina sua senha — Giro',robots:{index:false,follow:false}};
export default function Define(){return <DefinePassword configured={isSupabaseConfigured()}/>;}
