# Planos e administração do Giro

O proprietário usa `/admin` para abrir os dois painéis e configurar as vendas. Somente contas registradas em `giro_private.administrators` têm isenção. A atribuição é pelo UUID do usuário confirmado, feita no banco; e-mail em código de cliente, cookie, `user_metadata`, escolha de perfil e página de obrigado não concedem acesso.

Os demais usuários precisam de assinatura vigente do painel correspondente: Motoboy por R$ 29,90/mês e Comerciante por R$ 59,90/mês. O pacote inclui 1 comerciante e 1 motoboy em contas separadas, por R$ 39,90 no primeiro mês e R$ 89,80/mês depois. Somente a administração tem os dois painéis sem pagamento.

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

Para instalação vazia, execute `schema.sql`, `merchant.sql`, `billing.sql`, `combo.sql` e atribua a conta do proprietário no banco antes do login. Em produção, use migrações; não reaplique os arquivos completos.

## Pacote e entrada por usuário

Cadastre na Kirvano uma assinatura mensal do pacote com primeira cobrança de R$ 39,90 e cobranças seguintes de R$ 89,80. A Kirvano documenta a opção de preço diferente na primeira cobrança. Cadastre também uma oferta do mesmo produto a R$ 89,80 desde o início, usada para novas compras de contas que já utilizaram a promoção. Preencha os dois links e IDs de oferta no administrador. O endpoint aceita as duas ofertas configuradas; a cobrança efetiva e sua periodicidade dependem das configurações da Kirvano, que precisam de teste real antes de abrir vendas.

Configure a página de obrigado como `/assinar?plano=combo`. Somente o pagamento confirmado libera o pacote; a URL não concede acesso. Depois da confirmação, essa página encaminha o comerciante a `/comerciante/equipe`. A assinatura libera o painel do comprador como comerciante e uma vaga separada de motoboy, não o painel de motoboy na conta do comprador.

O comerciante escolhe nome, usuário e senha inicial do motoboy. A API valida o pacote, reserva uma vaga com bloqueio de concorrência e cria a identidade pela API administrativa do Supabase Auth, sem enviar convite por e-mail. O Auth guarda a senha protegida; o aplicativo não registra senha em tabela, logs ou respostas. Um endereço técnico aleatório fica apenas no backend para o mecanismo de autenticação. O motoboy digita usuário e senha, e o servidor resolve o usuário sem expor um diretório público de contas. Há limites persistentes de tentativas por usuário e IP e mensagem genérica de falha. A senha pode ser redefinida pelo comerciante que criou aquela conta.

Os limites do pacote são uma vaga e um usuário globalmente único. Reservas pendentes têm prazo e podem ser retomadas sem criar novos acessos. A conclusão é idempotente. O acesso da vaga acompanha a validade do pacote no banco, inclusive bloqueio por expiração ou estorno, sem depender de renovar o JWT. A conta do motoboy não tem acesso ao faturamento ou painel do comerciante.

## Motoboy independente

O plano Motoboy não exige loja vinculada nem comerciante assinante. A opção **Entrega avulsa — sem loja** permite registrar a primeira entrega sem cadastrar um comércio. Internamente as entregas ficam no agrupamento pessoal Entregas avulsas para preservar o cálculo financeiro existente.

Criar o usuário incluído no pacote também não vincula loja e não compartilha entregas ou GPS automaticamente. O motoboy pode apresentar o Giro ao comércio onde trabalha e, se quiser compartilhar, aceitar o código com o estabelecimento escolhido. O GPS continua com ativação separada. O vínculo opcional autoriza somente os dados desse local; o financiamento do acesso por um comerciante não cria leitura automática das entregas.

`verify-combo.sql` verifica vaga única, concorrência, nomes de usuário, APIs exclusivas do backend, independência sem loja, vínculo opcional, isolamento dos dois perfis, bloqueio de tentativas, escolha da oferta normal após uso da promoção e estorno dos dois acessos. A identidade Auth nesses testes é uma fixture SQL sem senha ou sessão; o teste não simula uma cobrança real nem uma sessão de login real do provedor.

Referências do contrato consultado: [configurar webhook](https://help.kirvano.com/hc/central-de-ajuda/articles/1765385505-configurando-integracao-via-webhook) e [eventos de assinatura](https://help.kirvano.com/hc/central-de-ajuda/articles/1775656489-ex).
