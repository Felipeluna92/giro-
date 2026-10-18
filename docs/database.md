# Banco do Giro

Estrutura aplicada ao projeto Supabase `rsucosyomvbpxezhllik`, região São Paulo, pela migração `initialize_giro_relational_database`. O projeto do Reposita não faz parte desta estrutura.

## Tabelas

| Tabela | Finalidade | Relações |
| --- | --- | --- |
| `rider_accounts` | Nome, cidade, meta, turno ativo e revisão de salvamento | Uma linha por usuário de `auth.users` |
| `establishments` | Locais de trabalho e regra de remuneração | Cada local pertence a um usuário |
| `deliveries` | Pedido, cliente, endereço, telefone, valores, cobrança, localização e situação | Pertence ao usuário e ao estabelecimento do mesmo usuário |
| `financial_entries` | Despesas, extras, pagamentos recebidos e repasses | Pertence ao usuário; pagamentos e repasses exigem estabelecimento |

Os IDs de usuário vêm de `auth.uid()`, nunca de um campo informado pelo navegador. Nome e demais metadados de perfil são somente apresentação, sem função de autorização.

Todos os valores financeiros são inteiros em centavos. R$ 8,50 é armazenado como `850`. Um percentual de 80% usa `8000` (centésimos de percentual). O valor retido não pode superar o dinheiro recebido nem a remuneração daquela entrega.

O endereço confirmado pode ter latitude, longitude e rótulo. As fotos e o texto integral do OCR não são armazenados nesta versão.

## Leitura e salvamento

- `get_rider_workspace()` reconstrói o contrato do aplicativo a partir das quatro tabelas, usando uma leitura consistente. Um usuário novo recebe listas vazias e preferências padrão sem precisar de gatilho no cadastro.
- `save_rider_workspace(p_data, p_expected_revision)` salva o conjunto de dados em uma transação. A revisão aumenta a cada gravação. Uma revisão antiga retorna `40001`; nenhuma parte do conjunto é alterada.
- Ao restaurar um backup, os registros omitidos são removidos somente do próprio usuário. Entregas e lançamentos são removidos antes dos estabelecimentos para preservar as relações.
- Uma falha em qualquer registro desfaz a atualização de perfil, a revisão e as alterações das tabelas filhas.
- Limites iniciais: 100 estabelecimentos, 3.000 entregas e 3.000 lançamentos por usuário. O salvamento atual envia o conjunto completo; para históricos maiores, evoluir para operações por registro e paginação.

## Proteção e índices

RLS está habilitada nas quatro tabelas, com políticas específicas de SELECT, INSERT, UPDATE e DELETE. UPDATE tem `USING` e `WITH CHECK`. O acesso anônimo às tabelas e funções não está permitido.

As duas funções são `SECURITY INVOKER`, têm `search_path` vazio e não usam chaves administrativas. As relações compostas `(owner_id, establishment_id)` impedem referências a estabelecimentos de outro usuário.

Há índices por usuário e dia, situação da entrega e estabelecimento. O banco acabou de ser criado; índices ainda sem uso são esperados até haver dados e consultas reais.

## Verificação realizada

`supabase/verify.sql` foi executado no próprio banco. Os usuários e registros fictícios foram criados em uma transação e revertidos ao final, sem envio de e-mail e sem criar sessões.

Foram verificados:

- Gravação e leitura com igualdade dos dados, incluindo horários UTC e coordenadas.
- Persistência nas tabelas de entregas e lançamentos.
- Rejeição de uma revisão desatualizada.
- Reversão de toda a transação após erro em um valor financeiro.
- Bloqueio de troca de proprietário de uma conta.
- Isolamento de leitura e escrita entre dois usuários.
- Rejeição de uma entrega vinculada a estabelecimento de outro usuário.
- Restauração de um conjunto menor de dados.

A auditoria não apontou problemas de RLS ou execução privilegiada nas tabelas/funções. Apontou um aviso de Auth: a proteção contra senhas vazadas está desativada. Essa configuração é independente do esquema e pode depender do plano contratado. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

O cadastro real, o envio de e-mails e a gravação pelo domínio final ainda precisam ser verificados após a configuração do ambiente na Vercel.
