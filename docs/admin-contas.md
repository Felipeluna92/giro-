# Administração de contas do Giro

Entrada: `/admin`, exclusiva de contas cadastradas em `giro_private.administrators`. O login continua em `/entrar`. A administração de pagamentos existente foi preservada em `/admin/pagamentos`.

## Funções

- Resumo geral de contas, e-mails reais, assinantes pagantes únicos e testes vigentes.
- Busca por nome/e-mail; filtros de pago, teste, sem acesso, gerenciado e administrador; 25 contas por página.
- Plano, validade, cartão/Pix, próxima renovação cancelada, confirmação de e-mail, cadastro e última entrada.
- Link de senha enviado ao e-mail da conta, com confirmação na interface e intervalo mínimo entre envios. A senha existente de uma conta confirmada só muda quando a pessoa escolhe outra.
- Novo teste de motoboy ou comerciante por 1–30 dias (padrão 7), para e-mail novo ou existente. Sem Stripe e sem cobrança. Nova conta usa convite por e-mail; a entrega reaproveita o fluxo seguro de compra para impedir reaproveitamento de senha de cadastro não confirmado.
- Encerrar teste sem alterar registros de assinatura paga. Renovar teste pelo formulário substitui o prazo/perfil; não acumula dias.
- Histórico das últimas 12 ações registradas pelo novo painel.

## Definições

Assinantes pagos conta pessoas únicas com ao menos um período pago vigente (`active` ou `cancelled`, `paid_until > now()`). Não é receita nem quantidade de assinaturas Stripe. Um motoboy dependente de pacote aparece com acesso pela loja; não é outro comprador pago. E-mails exclui endereços técnicos `.invalid`. Contas gerenciadas entram por usuário; a senha é gerenciada pelo comerciante, sem tentativa de enviar e-mail para endereço técnico. Os indicadores são gerais; a busca filtra a lista.

Acessos de teste ficam em tabela separada, com RLS. A autorização de cada operação continua passando pelo servidor e pelo banco. O teste não dá acesso de administrador nem cria pacote/assento gerenciado. Um teste para cada perfil pode ser criado com e-mails separados. Não é uma oferta pública de teste gratuito da página de vendas.

## Proteções

RPCs de gestão exclusivas de `service_role`, com verificação adicional da conta administradora atual. API verifica usuário autenticado e flag vinda do banco em toda requisição. Escritas exigem origem exata. Dados e respostas não são armazenados em cache público. Não há exportação de senha, exclusão de usuário ou promoção para administrador. Limite de ações e intervalo de reenvio. Campos de busca, UUID, perfil e duração validados no servidor e no banco. Histórico não guarda senhas ou tokens.

## Verificação

- 50 testes automatizados aprovados; TypeScript e build de produção aprovados.
- `supabase/verify-admin-accounts.sql` aprovado no projeto Giro com rollback: autorização, RPC inacessível ao navegador, RLS, busca, classificação, duração, separação de portais, vencimento, revogação, preservação do pago e limite de reenvio.
- Advisors sem novos alertas decorrentes desta migração.
- Validação visual com dados fictícios, separada do ambiente real. O navegador sem sessão é encaminhado a `/entrar`; nenhuma senha real foi alterada e nenhum e-mail para cliente foi disparado nos testes.
- A entrega SMTP já configurada é usada; confirmação de recebimento de um convite novo depende de testar um destinatário autorizado pelo administrador.

Migração aplicada: `20261023210410_admin_account_management.sql`.
