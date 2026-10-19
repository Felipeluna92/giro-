# Planos e administração do Giro

O proprietário usa `/admin` para abrir os dois painéis e configurar as vendas. Somente contas registradas em `giro_private.administrators` têm isenção. A atribuição é pelo UUID do usuário confirmado, feita no banco; e-mail em código de cliente, cookie, `user_metadata`, escolha de perfil e página de obrigado não concedem acesso.

Os demais usuários precisam de assinatura vigente do painel correspondente. O plano Motoboy começa em R$ 29,90/mês. O Comerciante fica sem preço e sem venda aberta até o administrador definir a oferta. Uma conta pode adquirir ambos; apenas a administração tem os dois sem pagamento.

## Página de vendas

`/` mostra a página pública para visitantes. `/conheca` sempre abre a página de vendas, inclusive para o administrador. Ela apresenta os planos lidos do banco, ícones com volume feitos em CSS/SVG, simulação independente com dados fictícios, calculadora de equivalência de mensalidade e dúvidas frequentes. Não há upload real nem GPS na simulação.

`/assinar` permite escolher o plano, abrir o checkout quando configurado, conferir o e-mail da compra e consultar novamente a liberação. O cadastro é gratuito; ele não dá acesso às ferramentas. Uma conta autenticada sem assinatura é encaminhada a essa página. APIs protegidas respondem 402; as tabelas também têm políticas RLS restritivas, inclusive contra chamadas diretas ao Supabase.

## Configuração da Kirvano

1. Crie um produto e uma oferta com recorrência mensal para cada plano na Kirvano. Use um produto/oferta exclusivos do Giro e mantenha o preço de exibição igual ao checkout.
2. Em `/admin`, salve link do checkout (`https://pay.kirvano.com/...`), ID do produto, ID da oferta e preço. Deixe a venda desativada enquanto configura.
3. Gere o token de integração na administração e copie-o para o campo Token do webhook da Kirvano. O token aparece somente na geração; no banco fica apenas SHA-256.
4. Use o endpoint `https://giro-beryl.vercel.app/api/billing/webhook`. O cabeçalho inicial é `security-token`; a documentação pública da Kirvano descreve o token, mas não fixa o nome do cabeçalho. Confirme-o em um envio de teste e ajuste no administrador se necessário. Não há fallback inseguro por corpo ou URL.
5. Selecione `SALE_APPROVED`, `SUBSCRIPTION_RENEWED`, `SUBSCRIPTION_CANCELED`, `SUBSCRIPTION_EXPIRED`, `SALE_REFUNDED`, `SALE_CHARGEBACK`; um evento `TEST` também é aceito para verificar a autenticação. Nenhum evento sem token correto verifica ou libera acesso.
6. Atualize o status em `/admin`. Após um evento autenticado, marque abrir vendas e salve cada plano. Faça uma compra e um reembolso de teste no provedor antes dos anúncios; teste local não substitui o fluxo real da Kirvano.

Rotacionar o token pausa novas vendas e exige atualizar a Kirvano, testar e reabrir os planos. As assinaturas já pagas não são apagadas.

## Processamento

O endpoint usa uma chave Supabase de servidor existente (`SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`), sem expor seu valor. Nenhuma chave administrativa é enviada ao navegador. Somente esse papel executa as RPCs de registro de pagamentos e vinculação de compras pendentes.

A liberação exige evento aprovado, tipo recorrente, status aprovado e produto **e oferta** cadastrados. O vencimento vem de `plan.next_charge_date`, limitado a um período mensal de até 35 dias a partir do evento. Datas sem fuso seguem os exemplos brasileiros da Kirvano e são interpretadas como UTC−03:00. Não se inventam dias pagos quando falta vencimento. Eventos pendentes, Pix gerado, compra recusada e produtos não configurados não liberam acesso.

A compra é associada ao UUID de uma conta com o mesmo e-mail confirmado. Compras anteriores à confirmação ficam pendentes de associação e são vinculadas por uma operação exclusiva do servidor ao visitar `/assinar`. Depois de associada, uma venda não muda de dono. A assinatura armazena somente identificador da venda, plano, dono, e-mail necessário para associação, estado e datas; não armazena CPF, cartão, telefone ou payload completo.

Eventos repetidos não estendem validade, eventos antigos não substituem o estado mais recente e reembolso/chargeback são finais para aquela venda. Cancelamento conserva o período já pago; expiração e estorno bloqueiam. Outra compra válida continua liberando seu próprio período. RLS continua aplicando as regras de propriedade e vínculo; ser administrador não transforma os painéis em leitura indiscriminada de dados de terceiros.

Todas as funções novas são `SECURITY INVOKER`, com `search_path=''` e concessões específicas. O papel de servidor recebe somente `id`, `email` e `email_confirmed_at` de `auth.users` para a busca limitada do comprador; visitantes e usuários comuns não recebem essas permissões.

## Verificação

`npm run typecheck`, `npm test` e `npm run build` verificam aplicação e regras de interpretação. Os testes SQL executam com papéis reais e fixtures revertidas: `verify-billing.sql` cobre isenção, plano correto, usuário sem pagamento, assinatura expirada, e-mail não confirmado, impedimento de autopromoção, funções exclusivas do servidor, repetição, cancelamento e estorno. `verify-merchant.sql`, `verify-invites.sql` e `verify.sql` preservam as verificações de dados e isolamento anteriores.

Para instalação vazia, execute `schema.sql`, `merchant.sql`, `billing.sql` e atribua a conta do proprietário no banco antes do login. Em produção, use migrações; não reaplique os arquivos completos.

Referências do contrato consultado: [configurar webhook](https://help.kirvano.com/hc/central-de-ajuda/articles/1765385505-configurando-integracao-via-webhook) e [eventos de assinatura](https://help.kirvano.com/hc/central-de-ajuda/articles/1775656489-ex).
