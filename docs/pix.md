# Pix pré-pago

A compra oferece cartão com renovação mensal automática e Pix como pagamento único por 30 dias. O pacote custa R$ 39,90 na primeira compra elegível e R$ 89,80 nas seguintes, compartilhando o controle da promoção com o cartão. Motoboy custa R$ 29,90; Comerciante, R$ 59,90. Renovações Pix usam o mesmo e-mail e preservam o tempo já pago. O painel de assinatura mostra a validade e o link para renovar.

Pix usa Checkout `mode: payment` com preço definido no servidor. O webhook assinado recupera a sessão, os itens, o PaymentIntent e a cobrança na Stripe. Exige pagamento efetivo por Pix, conta/ambiente corretos, cliente e sessão vinculados no banco, moeda BRL, produto, quantidade e valor exatos. QR Code gerado, pagamento em processamento e página de sucesso não liberam acesso.

O registro privado guarda cada crédito. A renovação acrescenta 30 dias uma única vez. Reembolso integral e contestação retiram o crédito; a linha do tempo dos demais créditos é recalculada, para não manter dias estornados em uma renovação posterior. Uma contestação vencida restaura o crédito, sem criar outro período. Os RPCs de configuração, reserva, confirmação e resumo só são executáveis pelo backend. O status público exige o cookie assinado do visitante e a sessão exata.

Novos compradores recebem o convite para definir senha. Contas existentes mantêm a senha atual e recebem recuperação. O comerciante continua criando o usuário e a senha do novo motoboy do pacote. Não há vínculo obrigatório com loja.

## Ativação na Stripe

O Pix da conta de produção estava indisponível (`pix.available: false`, preferência `off`) na consulta de implantação. Não foi habilitado por inferência. O conector desta sessão só expõe consulta das configurações de formas de pagamento; o painel exige autenticação.

Depois de ativar Pix no Dashboard, consultar novamente `payment_method_configurations` na conta de produção configurada em `lib/stripe-catalog.ts`. Confirmar configuração ativa da própria conta (`application: null`), Pix disponível e preferência efetiva `on`. Somente então salvar o ID dessa configuração em `giro_private.payment_options.pix_configuration_id`. Não salvar chaves de API ou credenciais nessa tabela. Esse ID registra a ativação verificada da configuração padrão da própria conta. O Checkout usa `allowed_payment_method_types: ['pix']`, um filtro dinâmico que impede cartão, boleto e outros métodos no fluxo Pix, sem combinar configurações e exclusões incompatíveis.

Enquanto o ID não estiver configurado, a compra informa que Pix está indisponível e mantém o cartão funcionando. A configuração é lida por RPC backend, sem exigir acesso extra de leitura das configurações de pagamento para a chave restrita da aplicação. Nenhuma mudança de variável de ambiente ou novo deploy é necessário após a ativação verificada.

## Validação

`npm test` (41 testes) e `npm run build` passaram. `supabase/verify-pix.sql` testa créditos de 30 dias, renovação antecipada, duplicatas, promoção única, incompatibilidade de cliente e comprador, isolamento de visitantes, reembolso anterior a uma renovação, contestação e restauração, além das permissões. Todos os dados de teste ficam em transação com rollback. Não executar esse arquivo sem manter o rollback.

Ainda é necessário ativar a forma de pagamento na Stripe e testar a geração de um QR Code no checkout de produção. Não foi efetuado pagamento real por Pix nesta validação.
