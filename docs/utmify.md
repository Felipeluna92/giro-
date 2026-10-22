# UTMify no Giro

## Preparação no site

O servidor captura `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `src` e `sck` no acesso às páginas. A origem fica em cookie HttpOnly, SameSite=Lax, restrito ao host e com validade de sete dias. Em produção o cookie é Secure. Acesso sem UTMs mantém a última origem; nova campanha substitui o conjunto inteiro, sem misturar campanhas. Prefetch do Next não muda a origem e o sinal Global Privacy Control desativa a captura.

A sessão de Checkout e a assinatura recebem somente esses parâmetros permitidos em metadata. O campo `client_reference_id` do Checkout usa a codificação do script oficial da UTMify para Stripe: source, medium, campaign, content, term, separados por `__`, com IDs após `|` e limite de 200 caracteres. `src` e `sck` permanecem em metadata, mas não entram nessa codificação nativa. Para campanhas orgânicas, use `utm_source`.

A identidade do comprador e a liberação do plano continuam determinadas pelo usuário autenticado, customer Stripe e banco. Nenhum dado de campanha concede acesso. Checkout aberto é reutilizado para a mesma atribuição; quando uma nova referência de anúncio chega, o anterior é expirado antes de gerar uma sessão com nova atribuição. Isso não cancela assinaturas.

Não se instala um segundo processador de vendas por API: a confirmação para a UTMify será entregue diretamente pelo webhook nativo da Stripe, evitando duplicação por duas integrações.

## Concluir na conta UTMify

Criar uma integração de webhook para **Stripe** no painel UTMify. Copiar o destino HTTPS gerado e cadastrar na conta live Stripe do Giro (`acct_1TsnW9RwctN2fxkt`). Não alterar o endpoint de liberação de acesso do Giro.

O tutorial oficial "Configurar WebHook Stripe - Utmify", de Tutoriais Utmify, lista os eventos:

- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- charge.refunded
- charge.dispute.created

Referência: https://www.youtube.com/watch?v=yryPcEQjwG4
Script de referência: https://cdn.utmify.com.br/scripts/utms/latest.js (inspecionado em 22/10/2026).

Não criar pedidos falsos em produção para testar. Após configurar o destino, verificar entrega na Stripe e conferir uma compra com UTMs no painel UTMify. O webhook ainda não foi cadastrado e nenhuma compra foi usada para validar a atribuição ponta a ponta.

## Anúncios

Usar a URL de destino `https://giro-beryl.vercel.app/conheca` e copiar o modelo atual de parâmetros da própria UTMify para o campo de parâmetros da URL no Gerenciador de Anúncios. IDs de campanha, conjunto e anúncio devem ser preservados nos parâmetros; nomes com `|ID` são reduzidos ao ID no campo nativo Stripe, conforme o script oficial.

Exemplo manual, sem gasto ou compra: `/conheca?utm_source=instagram&utm_medium=organico&utm_campaign=lancamento&utm_content=motoboy_motion_01`.

Esta integração não instala pixel de navegador da Meta/TikTok. Eventos de compra, atribuição de anúncios, custos de mídia e eventual otimização por pixel devem ser conferidos na conta UTMify. O conjunto nativo acima cobre o checkout inicial; suporte a renovações de assinaturas deve ser confirmado na UTMify antes de considerar a receita recorrente reconciliada.
