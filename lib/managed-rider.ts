import {z} from 'zod';
export const usernameSchema=z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_.-]{2,31}$/,'Use de 3 a 32 letras, números, pontos, traços ou sublinhados.');
export const managedCreateSchema=z.object({action:z.literal('create'),name:z.string().trim().min(1).max(80),username:usernameSchema,password:z.string().min(8).max(128)});
export const managedPasswordSchema=z.object({action:z.literal('password'),password:z.string().min(8).max(128)});
