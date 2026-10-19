# Estado da preparação

- Aplicativo independente com Next.js e Supabase.
- Supabase exclusivo: `rsucosyomvbpxezhllik` (São Paulo).
- Estrutura relacional aplicada: perfil, estabelecimentos, entregas e lançamentos financeiros.
- RLS habilitada nas quatro tabelas. APIs de leitura e gravação restritas a usuários autenticados.
- Testes no banco aprovados: leitura/gravação, revisão concorrente, reversão atômica, isolamento e relações entre usuários. Registros de teste revertidos.
- Aplicativo publicado em `https://giro-beryl.vercel.app`; página de entrada e bloqueio da API sem sessão verificados.
- Área do comerciante implementada: convites, equipe, entregas, acertos e GPS compartilhado. Funções de banco usam permissões do usuário e RLS.
- Testes de comerciante aprovados no PostgreSQL local e no Supabase, com contas fictícias revertidas ao final. Rastreamento físico em celular e navegação autenticada das duas pessoas ainda precisam de teste de uso real.
- Leitura por IA integrada ao AI Gateway; nova revisão inclui ampliações de comandas longas, validação de campos e erros explícitos.
- A execução do modelo em uma sessão autenticada de produção ainda precisa de validação. A consulta aos logs retornou 403 em 18/10/2026; não há evidência para declarar o teste completo aprovado.
