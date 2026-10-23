# Pix pré-pago

A compra oferece cartão com renovação mensal automática e Pix como pagamento único por 30 dias. O pacote custa R$ 39,90 na primeira compra elegível e R$ 89,80 nas seguintes, compartilhando o controle da promoção com o cartão. Motoboy custa R$ 29,90; Comerciante, R$ 59,90. Renovações Pix usam o mesmo e-mail e preservam o tempo já pago. O painel de assinatura mostra a validade e o link para renovar.

Pix usa Checkout `mode: payment` com preço definido no servidor. O webhook assinado recupera a sessão, os itens, o PaymentIntent e a cobrança na Stripe. Exige pagamento efetivo por Pix, conta/ambiente corretos, cliente e sessão vinculados no banco, moeda BRL, produto, quantidade e valor exatos. QR Code gerado, pagamento em processamento e página de sucesso não liberam acesso.

O registro privado guarda cada crédito. A renovação acrescenta 30 dias uma única vez. Reembolso integral e contestação retiram o crédito; a linha do tempo dos demais créditos é recalculada, para não manter dias estornados em uma renovação posterior. Uma contestação vencida restaura o crédito, sem criar outro período. Os RPCs de configuração, reserva, confirmação e resumo só são executáveis pelo backend. O status público exige o cookie assinado do visitante e a sessão exata.

Novos compradores recebem o convite para definir senha. Contas existentes mantêm a senha atual e recebem recuperação. O comerciante continua criando o usuário e a senha do novo motoboy do pacote. Não há vínculo obrigatório com loja.

## Ativação na Stripe

Na implantação inicial, Pix estava indisponível na conta de produção e foi mantido desativado. Em 23/10/2026, a configuração padrão da própria conta foi consultada novamente: ativa, `pix.available: true` e preferência efetiva `on`. O ID verificado foi salvo no registro privado de configuração do Giro.

Depois de ativar Pix no Dashboard, consultar novamente `payment_method_configurations` na conta de produção configurada em `lib/stripe-catalog.ts`. Confirmar configuração ativa da própria conta (`application: null`), Pix disponível e preferência efetiva `on`. Somente então salvar o ID dessa configuração em `giro_private.payment_options.pix_configuration_id`. Não salvar chaves de API ou credenciais nessa tabela. Esse ID registra a ativação verificada da configuração padrão da própria conta. O Checkout usa `allowed_payment_method_types: ['pix']`, um filtro dinâmico que impede cartão, boleto e outros métodos no fluxo Pix, sem combinar configurações e exclusões incompatíveis.

Enquanto o ID não estiver configurado, a compra informa que Pix está indisponível e mantém o cartão funcionando. A configuração é lida por RPC backend, sem exigir acesso extra de leitura das configurações de pagamento para a chave restrita da aplicação. Nenhuma mudança de variável de ambiente ou novo deploy é necessário após a ativação verificada.

## Validação

`npm test` e `npm run build` passaram, incluindo a cobertura de pagamentos Pix. `supabase/verify-pix.sql` testa créditos de 30 dias, renovação antecipada, duplicatas, promoção única, incompatibilidade de cliente e comprador, isolamento de visitantes, reembolso anterior a uma renovação, contestação e restauração, além das permissões. Todos os dados de teste ficam em transação com rollback. Não executar esse arquivo sem manter o rollback.

Em 23/10/2026, a compra pública abriu o checkout de produção com Pix como único método. O QR Code e o Pix Copia e Cola foram gerados, com validade de 30 minutos, sem efetuar pagamento real. Após o redesign da página de vendas, a abertura dos checkouts de cartão e Pix foi verificada novamente. A confirmação de uma compra Pix real e a entrega de acesso após esse pagamento não foram executadas neste teste.
