# Compra antes do cadastro

Os botões públicos de compra abrem `/comprar?plano=rider`, `merchant` ou `combo`. A página pede somente o e-mail e encaminha para o Checkout da Stripe. Não exige sessão ou senha.

O webhook assinado verifica a assinatura, o cliente, a sessão e a fatura efetivamente paga antes de convidar o comprador. Contas confirmadas existentes recebem um link de recuperação e mantêm a senha atual até alterá-la. Novos compradores recebem um convite para definir a senha em `/definir-senha`. Metadados, parâmetros da URL e a página de sucesso não concedem acesso.

A tabela privada `purchase_checkouts` guarda as reservas e os vínculos de pagamento. A migração é aditiva e mantém as chaves anteriores. Contas que compram por mais de um cliente Stripe conseguem selecionar a cobrança no portal. A promoção do combo fica reservada por e-mail; a renovação normal é informada antes da compra.

## Liberação

Antes de liberar o checkout público, verificar no Supabase o SMTP personalizado para envio a compradores externos, o remetente e as URLs permitidas de redirecionamento. Incluir `https://giro-beryl.vercel.app/auth/callback` e `https://giro-beryl.vercel.app/auth/callback?next=/definir-senha`, conforme a configuração de URLs do projeto. Verificar a entrega do convite e da recuperação e testar o link em outro navegador.

O SMTP personalizado da Brevo foi configurado. O teste real de recuperação retornou HTTP 200 no Supabase e o provedor confirmou o evento `Entregue` após a correção do remetente para um endereço verificado. A Brevo substitui o endereço Gmail pelo seu domínio de envio neste modo. Não basta considerar o retorno HTTP: conferir o evento de entrega no provedor.

As URLs de callback e de definição de senha foram permitidas no Supabase. O envio de recuperação foi validado; o convite de um comprador novo após uma cobrança real e a alteração de senha pelo destinatário não foram executados nesta validação. Nenhuma cobrança real foi feita.

## Validação

`npm test` (37 testes), `npm run typecheck` e `npm run build` passaram. `supabase/verify-purchase.sql` foi executado em transação com rollback: reserva da promoção, vinculação após pagamento, isolamento dos visitantes, preservação de clientes anteriores e bloqueio das funções para anon/authenticated. Não executar os testes SQL sem manter o rollback.
