import { NextResponse } from 'next/server';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { getRiderUser } from '../../../lib/auth';
import { createClient } from '../../../lib/supabase/server';

export const maxDuration = 60;

const receiptSchema = z.object({
  establishment: z.string().max(100).nullable().describe('Nome do estabelecimento, quando estiver visível'),
  order: z.string().max(60).nullable().describe('Número do pedido ou da comanda'),
  customer: z.string().max(100).nullable(),
  phone: z.string().max(30).nullable(),
  address: z.string().max(400).nullable().describe('Endereço completo, incluindo bairro, cidade, estado e CEP visíveis'),
  complement: z.string().max(300).nullable().describe('Apartamento, bloco, casa ou referência, sem repetir o endereço'),
  customerFeeCents: z.number().int().min(0).max(100000000).nullable().describe('Taxa de entrega em centavos; não confundir com taxa de serviço'),
  orderTotalCents: z.number().int().min(0).max(100000000).nullable().describe('Total final a cobrar do cliente em centavos'),
  payment: z.enum(['paid', 'cash', 'card', 'pix']).nullable(),
  notes: z.string().max(1500).nullable().describe('Itens e instruções úteis que não pertencem aos outros campos'),
  rawText: z.string().max(5000).describe('Transcrição fiel e organizada de todo texto legível'),
  confidence: z.number().min(0).max(1).describe('Confiança geral da leitura entre 0 e 1'),
});

export async function POST(request: Request) {
  const rider = await getRiderUser();
  if (!rider) return NextResponse.json({ error: 'Entre na sua conta para ler a comanda.' }, { status: 401 });

  const form = await request.formData();
  const image = form.get('image');
  if (!(image instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 4_000_000) {
    return NextResponse.json({ error: 'Envie uma foto JPG, PNG ou WebP de até 4 MB.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: allowed, error: limitError } = await supabase.rpc('claim_ai_scan');
  if (limitError) return NextResponse.json({ error: 'Não foi possível liberar a leitura inteligente.' }, { status: 500 });
  if (!allowed) return NextResponse.json({ error: 'Você atingiu o limite diário de leituras inteligentes.' }, { status: 429 });

  const model = process.env.AI_GATEWAY_MODEL;
  if (!model) return NextResponse.json({ error: 'A leitura inteligente ainda não está configurada.' }, { status: 503 });

  try {
    const result = await generateText({
      model,
      output: Output.object({ schema: receiptSchema }),
      instructions: 'Você extrai dados de comandas brasileiras impressas ou manuscritas. Leia a imagem diretamente. Preserve nomes e números visíveis, aceite caligrafia e nunca invente conteúdo. Valores devem ser números inteiros em centavos. Diferencie taxa de entrega, taxa de serviço, subtotal e total final. Se um campo não estiver visível, retorne null. Em pagamento, use card para débito ou crédito, cash para dinheiro, pix para Pix e paid quando já estiver pago.',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'Extraia e estruture esta comanda. Em rawText, transcreva as linhas legíveis.' },
          { type: 'image', image: new Uint8Array(await image.arrayBuffer()), mediaType: image.type },
        ],
      }],
    });
    if (!result.output) throw new Error('Empty structured output');
    return NextResponse.json(result.output);
  } catch {
    return NextResponse.json({ error: 'A leitura inteligente não respondeu. Tente novamente.' }, { status: 502 });
  }
}
