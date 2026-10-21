# Planos e administração do Giro

O proprietário usa `/admin` para abrir os dois painéis e configurar as vendas. Somente contas registradas em `giro_private.administrators` têm isenção. A atribuição é pelo UUID do usuário confirmado, feita no banco; e-mail em código de cliente, cookie, `user_metadata`, escolha de perfil e página de obrigado não concedem acesso.

Os demais usuários precisam de assinatura vigente do painel correspondente: Motoboy por R$ 29,90/mês e Comerciante por R$ 59,90/mês. O pacote inclui 1 comerciante e 1 motoboy em contas separadas, por R$ 39,90 no primeiro mês e R$ 89,80/mês depois. Somente a administração tem os dois painéis sem pagamento.

## Página de vendas

`/` mostra a página pública para visitantes. `/conheca` sempre abre a página de vendas, inclusive para o administrador. Ela apresenta os planos lidos do banco, ícones com volume feitos em CSS/SVG, simulação independente com dados fictícios, calculadora de equivalência de mensalidade e dúvidas frequentes. Não há upload real nem GPS na simulação.

`/assinar` permite escolher o plano, abrir o checkout quando configurado, conferir o e-mail da compra e consultar novamente a liberação. O cadastro é gratuito; ele não dá acesso às ferramentas. Uma conta autenticada sem assinatura é encaminhada a essa página. APIs protegidas respondem 402; as tabelas também têm políticas RLS restritivas, inclusive contra chamadas diretas ao Supabase.

## Stripe: checkout e assinaturas

O catálogo ativo fica em `lib/stripe-catalog.ts`: três produtos separados, cada um com preço mensal em BRL. O pacote tem mensalidade de R$ 89,80 e cupom restrito ao produto, de R$ 49,90 com duração `once`; a primeira fatura elegível fica em R$ 39,90. O banco registra o uso da promoção após pagamento, inclusive quando há reembolso posterior.

O servidor cria uma Checkout Session em modo `subscription`, com faturamento flexível e métodos de pagamento dinâmicos da Stripe. Cada cliente Stripe é associado ao UUID autenticado no Giro antes de abrir o checkout. A propriedade do pagamento vem dessa associação no banco, não de metadados editáveis, do e-mail digitado na compra ou da URL de retorno. O usuário deve ter confirmado o e-mail no Supabase antes de assinar.

Há reserva de checkout por conta, chave de idempotência persistida, reaproveitamento de checkout aberto e verificação de assinaturas já existentes. Os planos Comerciante e Pacote não podem gerar renovações sobrepostas. O plano Motoboy pode coexistir com um pacote que financia outro motoboy.

### Configuração privada do servidor

Na Vercel, ambiente Production:

- `STRIPE_ACCOUNT_ID`: conta Stripe de produção confirmada pelo proprietário.
- `STRIPE_WEBHOOK_SECRET`: segredo de assinatura do endpoint, salvo como Secret. Já provisionado pela integração; não precisa copiar para o código.
- `STRIPE_SECRET_KEY`: chave **restrita** de produção criada pelo titular e salva como Secret. O acesso do ChatGPT à Stripe não fornece uma credencial permanente ao aplicativo.
- `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`: credencial existente do backend Supabase, nunca pública.

A chave restrita deve permitir leitura e escrita em Customers e Checkout Sessions, escrita no Customer Portal e leitura em Products, Prices, Coupons, Subscriptions, Invoices, Invoice Payments, PaymentIntents, Charges e Disputes. Os nomes/grupos de permissões podem variar na tela da Stripe. A validação em `/admin` confere acesso aos três preços, cupom, configuração do portal e banco sem cobrar clientes. Não compartilhe chaves em mensagens; não use prefixo `NEXT_PUBLIC_` em segredos. Faça novo deploy após alterar o ambiente.

O catálogo mantém as vendas indisponíveis quando a chave ou o segredo do webhook estão ausentes. A validação administrativa e os testes de cobrança continuam necessários antes dos anúncios. Não foram habilitados Stripe Tax, cobrança automática de tributos ou alterações globais de recuperação de receita na conta. Stripe Tax exige avaliação e cadastros fiscais apropriados antes de ativar coleta automática.

### Notificações e liberação

Endpoint: `https://giro-beryl.vercel.app/api/stripe/webhook`. API e SDK fixados em `2026-09-30.endive` e `stripe@23.0.0`. O endpoint valida o corpo bruto e o cabeçalho `Stripe-Signature`, inclusive tolerância de tempo, e recusa eventos de teste ou de outra conta no ambiente de produção. Nenhum segredo é enviado ao navegador ou registrado em logs.

Eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated` e `charge.dispute.closed`.

O servidor consulta o estado atual da assinatura, a fatura e seus Invoice Payments. Só um pagamento confirmado por PaymentIntent bem-sucedido para a conta correta e um período mensal válido concedem acesso. Faturas pendentes, pagamentos parciais, períodos inválidos, preços diferentes ou marcação manual de fatura paga sem pagamento Stripe não liberam o produto.

O registro por fatura permite renovar o período pago sem duplicar acesso em reenvios. Eventos repetidos são idempotentes; cancelamento da renovação preserva o período pago; reembolso integral ou disputa revogam a fatura correspondente. Reembolso de uma fatura antiga não apaga um período posterior pago. Uma disputa ganha restaura o período pago ainda válido. A validade é consultada pelo banco em cada autorização e não depende de atualizar o JWT.

O evento adicional `product.updated`, restrito aos produtos Giro, verifica a entrega real do webhook sem cobrar ninguém. Registra somente um identificador de saúde; não concede assinatura. O status administrativo diferencia notificação recebida de pagamento validado.

O endpoint legado `/api/billing/webhook` responde 410, e os formulários/RPCs de checkout e token da Kirvano foram retirados de uso. Os dados históricos permanecem preservados.

### Gestão pelo assinante

`/assinar` permite abrir o checkout, consultar a liberação e usar **Gerenciar assinatura, cartão e faturas**. O portal Stripe permite atualizar dados/cartão, consultar faturas e cancelar a renovação ao final do período. Troca de plano no portal está desativada para manter os direitos de Comerciante e Pacote consistentes; uma troca deve ser planejada após o cancelamento/encerramento correspondente.

Retornos do checkout: `/assinar?plano=rider&pagamento=recebido`, `/assinar?plano=merchant&pagamento=recebido` ou `/assinar?plano=combo&pagamento=recebido`. A tela aguarda e consulta o acesso por até um minuto; também oferece atualização manual. O retorno nunca concede acesso por si só. Após pagamento do pacote, o comerciante segue para `/comerciante/equipe`.

### Banco e verificação

Use migrações em produção. Para um banco vazio, a ordem é `schema.sql`, `merchant.sql`, `billing.sql`, `combo.sql`, `stripe.sql`; não reaplique arquivos completos no banco existente. As novas tabelas do schema privado têm RLS e só o backend pode mudar clientes, reservas de checkout, faturas e eventos. Funções são `SECURITY INVOKER`, com `search_path=''` e concessões explícitas.

`npm run typecheck`, `npm test` e `npm run build` verificam tipos, regras de período/assinatura/assinatura criptográfica e compilação. `supabase/verify-stripe.sql` usa papéis reais e uma transação revertida para testar propriedade do cliente, concorrência, pagamento pendente, pacote, promoção, duplicatas, ordem de eventos, cancelamento, reembolso, fatura posterior, disputa e bloqueio de chamadas pelo usuário.

Os testes históricos `verify-billing.sql` e `verify-combo.sql` contêm chamadas à configuração antiga: execute-os antes de `stripe.sql` em um ambiente vazio, ou adapte as verificações legadas em ambiente já migrado. Não reaplique privilégios antigos para fazê-los passar na produção. Testes com fixtures não substituem um ciclo completo de cobrança em sandbox com chave própria e configuração de catálogo desse ambiente.

## Pacote e entrada por usuário

O produto Pacote usa a mensalidade normal de R$ 89,80. A Checkout Session aplica o cupom de primeira fatura somente quando o banco informa que a promoção ainda não foi usada. Não há checkout promocional público reutilizável.

Configure a página de obrigado como `/assinar?plano=combo`. Somente o pagamento confirmado libera o pacote; a URL não concede acesso. Depois da confirmação, essa página encaminha o comerciante a `/comerciante/equipe`. A assinatura libera o painel do comprador como comerciante e uma vaga separada de motoboy, não o painel de motoboy na conta do comprador.

O comerciante escolhe nome, usuário e senha inicial do motoboy. A API valida o pacote, reserva uma vaga com bloqueio de concorrência e cria a identidade pela API administrativa do Supabase Auth, sem enviar convite por e-mail. O Auth guarda a senha protegida; o aplicativo não registra senha em tabela, logs ou respostas. Um endereço técnico aleatório fica apenas no backend para o mecanismo de autenticação. O motoboy digita usuário e senha, e o servidor resolve o usuário sem expor um diretório público de contas. Há limites persistentes de tentativas por usuário e IP e mensagem genérica de falha. A senha pode ser redefinida pelo comerciante que criou aquela conta.

Os limites do pacote são uma vaga e um usuário globalmente único. Reservas pendentes têm prazo e podem ser retomadas sem criar novos acessos. A conclusão é idempotente. O acesso da vaga acompanha a validade do pacote no banco, inclusive bloqueio por expiração ou estorno, sem depender de renovar o JWT. A conta do motoboy não tem acesso ao faturamento ou painel do comerciante.

## Motoboy independente

O plano Motoboy não exige loja vinculada nem comerciante assinante. A opção **Entrega avulsa — sem loja** permite registrar a primeira entrega sem cadastrar um comércio. Internamente as entregas ficam no agrupamento pessoal Entregas avulsas para preservar o cálculo financeiro existente.

Criar o usuário incluído no pacote também não vincula loja e não compartilha entregas ou GPS automaticamente. O motoboy pode apresentar o Giro ao comércio onde trabalha e, se quiser compartilhar, aceitar o código com o estabelecimento escolhido. O GPS continua com ativação separada. O vínculo opcional autoriza somente os dados desse local; o financiamento do acesso por um comerciante não cria leitura automática das entregas.

`verify-combo.sql` verifica vaga única, concorrência, nomes de usuário, APIs exclusivas do backend, independência sem loja, vínculo opcional, isolamento dos dois perfis, bloqueio de tentativas, escolha da oferta normal após uso da promoção e estorno dos dois acessos. A identidade Auth nesses testes é uma fixture SQL sem senha ou sessão; o teste não simula uma cobrança real nem uma sessão de login real do provedor.

Referências: [assinaturas e webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [Checkout](https://docs.stripe.com/payments/checkout/build-subscriptions), [Customer Portal](https://docs.stripe.com/customer-management/integrate-customer-portal).
