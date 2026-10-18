# Giro — seu turno no controle

Aplicativo independente para motoboys, preparado para **Next.js na Vercel** e **Supabase Auth + PostgreSQL**. Este repositório é separado do Reposita.

## Recursos

- Comandas por foto, com OCR local em português e conferência dos campos.
- Cadastro, edição, cancelamento, conclusão e reabertura de entregas.
- Ganho integral, fixo ou percentual por estabelecimento.
- Navegação, telefone e WhatsApp do cliente.
- Busca e confirmação de endereços, rotas estimadas com até oito paradas e mapa.
- Ganhos, gorjetas, despesas, diárias, pagamentos e repasses separados.
- Meta diária, exportação CSV, backup e restauração JSON.
- Login, cadastro, confirmação de e-mail e recuperação de senha pelo Supabase.

## Configuração do Supabase

O projeto exclusivo do Giro já foi criado na região São Paulo: `rsucosyomvbpxezhllik`.

1. No SQL Editor desse projeto, execute **uma vez** o arquivo `supabase/schema.sql`. Ele cria a tabela, as políticas de acesso por usuário e a função de salvamento com controle de concorrência. Não execute no banco do Reposita.
2. Em **Settings → API Keys**, obtenha a **Publishable key**. O aplicativo não precisa de chave secret ou service role.
3. Em **Authentication → URL Configuration**, configure a **Site URL** com a URL final da Vercel e inclua `https://SEU-DOMINIO/auth/callback` e `https://SEU-DOMINIO/auth/callback?next=/redefinir-senha` entre os redirecionamentos permitidos.
4. Mantenha a confirmação de e-mail habilitada. O cadastro usa PKCE; abra o e-mail no mesmo navegador em que começou o cadastro. Se o link expirar ou for aberto em outro aparelho, solicite um novo e-mail ou entre com sua senha após confirmar a conta.
5. Antes de um lançamento público, configure o envio de e-mails de produção no Supabase e teste cadastro e recuperação no domínio final.

### Dados protegidos

A tabela utiliza RLS: cada usuário acessa apenas a linha associada ao próprio `auth.uid()`. As APIs validam a identidade no servidor, validam o conteúdo e usam uma função `SECURITY INVOKER`, sem ignorar as políticas de acesso. Não há chave administrativa no código ou no navegador.

## Importação na Vercel

1. **Add New → Project → Import Git Repository** e selecione `Felipeluna92/giro-`.
2. Framework: **Next.js**. Diretório raiz: `./`. Os comandos padrão são suficientes (`npm install` / `npm run build`).
3. Defina as variáveis abaixo antes da publicação:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rsucosyomvbpxezhllik.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A Publishable key desse projeto no Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL final do Giro, para referência na configuração de redirecionamentos |

4. Publique e finalize a configuração dos URLs no Supabase.
5. Teste cadastro, confirmação de e-mail, login, gravação de entrega, recarga da página e saída.

Não coloque senhas ou chaves administrativas no GitHub. `.env.local` e `.vercel` são ignorados pelo Git.

## Desenvolvimento e verificação

Requer Node.js 22.13 ou superior. As versões são fixadas e o `package-lock.json` acompanha o projeto.

```sh
npm ci
cp .env.example .env.local
npm run typecheck
npm test
npm run build
npm run dev
```

As variáveis em `.env.local` devem usar o projeto correto. A configuração do banco precisa ser concluída antes de testar gravações.

## Limites desta primeira versão

O OCR reconhece texto impresso e extrai campos por regras; a conferência humana é indispensável. As fotos e o texto integral reconhecido não são armazenados. Os dados confirmados precisam de conexão para salvar no Supabase. A migração de registros do protótipo anterior pode ser feita exportando o backup JSON e restaurando após entrar no novo aplicativo.

Photon e OSRM são serviços públicos de teste, sujeitos a indisponibilidade. As rotas usam vias para carro, sem perfil específico de moto nem trânsito ao vivo, e não incluem espera ou retirada. Endereços precisam ser conferidos pelo usuário. Contrate ou hospede provedores apropriados antes de escalar o uso comercial.

A prioridade é uma marcação para decisão manual. O cálculo das rotas minimiza o tempo de um caminho aberto com saída fixa; não calcula retorno ao estabelecimento.

O financeiro considera o dia de conclusão no fuso `America/Sao_Paulo`. Acertos por estabelecimento acumulam todos os dias; o fechamento diário inclui somente os registros da data selecionada. O dinheiro recebido por pedidos não é somado como ganho pessoal.

A demonstração é claramente identificada, funciona apenas em memória e não altera registros reais. Esta versão ainda não inclui assinaturas, cobrança ou painel de distribuição de entregas para restaurantes.
