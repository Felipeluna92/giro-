import { NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { getRiderUser } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase/server';
import { receiptSchema, receiptInstructions, reviewReceipt, receiptServiceError } from '../../../lib/receipt';

export const maxDuration = 60;
const respond = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });

function imageSignature(bytes: Uint8Array, type: string) {
  if (type === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === 'image/png') return [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  return type === 'image/webp' && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
}

export async function POST(request: Request) {
  const rider = await getRiderUser();
  if (!rider) return respond({ error: 'Entre na sua conta para ler a comanda.', code: 'AUTH_REQUIRED' }, 401);
  if (!rider.access.rider) return respond({error:'Ative o plano Motoboy para ler comandas.',code:'PLAN_REQUIRED'},402);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return respond({ error: 'Origem inválida.' }, 403);
  const model = process.env.AI_GATEWAY_MODEL;
  if (!model) return respond({ error: 'A leitura por IA ainda não está configurada.', code: 'AI_UNAVAILABLE' }, 503);
  if (Number(request.headers.get('content-length')) > 4_000_000) return respond({ error: 'A foto ficou muito grande. Tente outra imagem.' }, 413);

  let form: FormData;
  try { form = await request.formData(); } catch { return respond({ error: 'A foto enviada é inválida.' }, 400); }
  const images = [...form.getAll('image'), ...form.getAll('detail')];
  if (form.getAll('image').length !== 1 || images.length > 3 || images.some(image => !(image instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || !image.size)) {
    return respond({ error: 'Envie uma foto JPG, PNG ou WebP.' }, 400);
  }
  const files = images as File[];
  if (files.reduce((total, file) => total + file.size, 0) > 3_800_000) return respond({ error: 'A foto ficou muito grande. Tente outra imagem.' }, 413);
  const bytes = await Promise.all(files.map(async file => new Uint8Array(await file.arrayBuffer())));
  if (bytes.some((image, i) => !imageSignature(image, files[i].type))) return respond({ error: 'O arquivo não é uma imagem válida.' }, 400);

  const supabase = await createClient();
  const { data: allowed, error: limitError } = await supabase.rpc('claim_ai_scan');
  if (limitError) return respond({ error: 'Não foi possível liberar a leitura inteligente.', code: 'QUOTA_FAILED' }, 503);
  if (!allowed) return respond({ error: 'Você atingiu o limite diário de 40 leituras inteligentes.', code: 'DAILY_LIMIT' }, 429);

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: receiptSchema }),
      instructions: receiptInstructions,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(48_000),
      telemetry: { isEnabled: false },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Leia a foto completa e use as ampliações para conferir os caracteres. Todas mostram uma única comanda. Extraia os campos sem completar informações ausentes.' },
          ...bytes.map((image, i) => ({ type: 'image' as const, image, mediaType: files[i].type })),
        ],
      }],
    });
    if (!result.output) throw new Error('Empty structured output');
    const reviewed = reviewReceipt(result.output);
    console.info('receipt_scan_completed', { reviewCount: reviewed.review.length });
    return respond(reviewed);
  } catch (error) {
    const failure = receiptServiceError(error);
    // Never log photo, transcription, customer data, or raw provider responses.
    console.error('receipt_scan_failed', { code: failure.code });
    return respond({ error: failure.error, code: failure.code }, failure.status);
  }
}
