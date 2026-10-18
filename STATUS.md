# Estado da preparação

- Aplicativo independente com Next.js e Supabase.
- Supabase exclusivo: `rsucosyomvbpxezhllik` (São Paulo).
- Estrutura relacional aplicada: perfil, estabelecimentos, entregas e lançamentos financeiros.
- RLS habilitada nas quatro tabelas. APIs de leitura e gravação restritas a usuários autenticados.
- Testes no banco aprovados: leitura/gravação, revisão concorrente, reversão atômica, isolamento e relações entre usuários. Registros de teste revertidos.
- Configuração de variáveis na Vercel e URLs de autenticação ainda pendente de verificação.
- Login e gravação pelo domínio final ainda precisam de teste após configurar o ambiente.
