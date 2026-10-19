# Giro — seu turno no controle

Aplicativo independente para motoboys, preparado para **Next.js na Vercel** e **Supabase Auth + PostgreSQL**. Este repositório é separado do Reposita.

## Recursos

- Login com escolha entre motoboy e comerciante, com painéis próprios.
- Painel do comércio com equipe vinculada, entregas, taxas e mapa de localização compartilhada durante o turno.
- Convites de uso único e autorização por estabelecimento. Consulte `docs/merchant.md` para conectar as contas.
- Comandas impressas e manuscritas por visão multimodal, com ampliações de fotos longas e conferência dos campos.
- Validação de telefone, separação de taxa de entrega/serviço e aviso quando os valores não fecham com o total escrito.
- Repetição de leitura na mesma foto e leitor local de texto impresso como alternativa explícita.
- Cadastro, edição, cancelamento, conclusão e reabertura de entregas.
- Ganho integral, fixo ou percentual por estabelecimento.
- Navegação, telefone e WhatsApp do cliente.
- Busca e confirmação de endereços, rotas estimadas com até oito paradas e mapa.
- Ganhos, gorjetas, despesas, diárias, pagamentos e repasses separados.
- Meta diária, exportação CSV, backup e restauração JSON.
- Login, cadastro, confirmação de e-mail e recuperação de senha pelo Supabase.

## Configuração do Supabase

O projeto exclusivo do Giro já foi criado na região São Paulo: `rsucosyomvbpxezhllik`.

1. A estrutura do banco **já foi aplicada** no projeto exclusivo do Giro. Para recriar um ambiente vazio, use `supabase/schema.sql` e depois `supabase/merchant.sql`; não execute novamente no banco existente. A área do motoboy é descrita em `docs/database.md` e a do comerciante em `docs/merchant.md`.
2. Em **Settings → API Keys**, obtenha a **Publishable key**. O aplicativo não precisa de chave secret ou service role.
3. Em **Authentication → URL Configuration**, configure a **Site URL** com a URL final da Vercel e inclua `https://SEU-DOMINIO/auth/callback` e `https://SEU-DOMINIO/auth/callback?next=/redefinir-senha` entre os redirecionamentos permitidos.
4. Mantenha a confirmação de e-mail habilitada. O cadastro usa PKCE; abra o e-mail no mesmo navegador em que começou o cadastro. Se o link expirar ou for aberto em outro aparelho, solicite um novo e-mail ou entre com sua senha após confirmar a conta.
5. Antes de um lançamento público, configure o envio de e-mails de produção no Supabase e teste cadastro e recuperação no domínio final.

### Dados protegidos

As tabelas `rider_accounts`, `establishments`, `deliveries` e `financial_entries` utilizam RLS. Cada usuário acessa apenas registros associados ao próprio `auth.uid()`. As relações impedem vincular uma entrega ou um lançamento ao estabelecimento de outro usuário. As APIs validam a identidade e o conteúdo no servidor e usam funções `SECURITY INVOKER`, sem ignorar as políticas. Não há chave administrativa no código ou no navegador.

## Importação na Vercel

1. **Add New → Project → Import Git Repository** e selecione `Felipeluna92/giro-`.
2. Framework: **Next.js**. Diretório raiz: `./`. Os comandos padrão são suficientes (`npm install` / `npm run build`).
3. Defina as variáveis abaixo antes da publicação:

| Variável | Valor |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rsucosyomvbpxezhllik.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | A Publishable key desse projeto no Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL final do Giro, para referência na configuração de redirecionamentos |
| `AI_GATEWAY_MODEL` | ID de modelo com entrada de imagem e saída estruturada, disponível no AI Gateway |

4. Publique e finalize a configuração dos URLs no Supabase.
5. Teste cadastro, confirmação de e-mail, login, gravação de entrega, recarga da página e saída.

Não coloque senhas ou chaves administrativas no GitHub. `.env.local` e `.vercel` são ignorados pelo Git.

## Leitura de comandas

A rota autenticada `POST /api/ocr` utiliza AI Gateway com o OIDC da Vercel. Para desenvolvimento fora da Vercel, configure `AI_GATEWAY_API_KEY` em um ambiente privado; nunca use uma variável `NEXT_PUBLIC_` para essa chave. O acesso ao Gateway e os créditos precisam estar disponíveis na conta.

A foto completa é acompanhada por dois recortes sobrepostos quando o papel é longo, em uma única solicitação ao modelo. Campos críticos marcados como ambíguos ficam vazios para conferência. O total escrito é preservado mesmo quando há divergência aritmética, com aviso ao usuário. Pagamento ausente exige escolha antes de salvar. A foto e a transcrição não são gravadas no histórico do Giro; somente os campos confirmados são salvos. Logs do aplicativo registram códigos de resultado, sem dados do cliente ou conteúdo da foto.

Erros de configuração, limite, timeout e indisponibilidade ficam visíveis. O aplicativo não troca automaticamente uma falha da IA por um OCR local apresentado como sucesso. A alternativa local é indicada para texto impresso e precisa ser escolhida pelo usuário.

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

As variáveis em `.env.local` devem usar o projeto correto. O banco do projeto Giro já está estruturado; confirme os valores do ambiente antes de testar gravações. Os testes SQL em `supabase/verify.sql` verificam persistência, concorrência e isolamento em uma transação revertida.

## Limites desta primeira versão

O OCR reconhece texto impresso e extrai campos por regras; a conferência humana é indispensável. As fotos e o texto integral reconhecido não são armazenados. Os dados confirmados precisam de conexão para salvar no Supabase. A migração de registros do protótipo anterior pode ser feita exportando o backup JSON e restaurando após entrar no novo aplicativo.

Photon e OSRM são serviços públicos de teste, sujeitos a indisponibilidade. As rotas usam vias para carro, sem perfil específico de moto nem trânsito ao vivo, e não incluem espera ou retirada. Endereços precisam ser conferidos pelo usuário. Contrate ou hospede provedores apropriados antes de escalar o uso comercial.

A prioridade é uma marcação para decisão manual. O cálculo das rotas minimiza o tempo de um caminho aberto com saída fixa; não calcula retorno ao estabelecimento.

O financeiro considera o dia de conclusão no fuso `America/Sao_Paulo`. Acertos por estabelecimento acumulam todos os dias; o fechamento diário inclui somente os registros da data selecionada. O dinheiro recebido por pedidos não é somado como ganho pessoal.

A demonstração é claramente identificada, funciona apenas em memória e não altera registros reais. O Giro inclui página de vendas interativa, planos separados por painel, isenção administrativa e integração de assinaturas com a Kirvano. A abertura de vendas depende de configurar e testar as ofertas no provedor; veja [planos e cobrança](docs/billing.md). O comerciante acompanha entregas vinculadas; esta versão ainda não distribui pedidos para a equipe.
