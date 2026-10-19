# Comerciantes e motoboys

O login oferece “Sou motoboy” e “Sou comerciante”. A escolha define o destino inicial; a autorização de dados continua vinculada ao usuário autenticado e aos vínculos aceitos no banco. O cookie de preferência não concede acesso a outra conta.

## Conectar as contas

1. O comerciante entra em `/comerciante`, cadastra o nome do comércio e gera um código.
2. O motoboy cadastra o estabelecimento na sua área e abre **Meu comércio** no turno ou na aba de estabelecimentos.
3. Ele cola o código, escolhe o estabelecimento e confirma o compartilhamento de entregas e acertos desse local, incluindo o histórico.
4. Cada código pode ser usado uma vez, por até sete dias. Outros motoboys precisam de novos códigos. Ambos podem desfazer o vínculo.

Um estabelecimento do motoboy só pode estar ligado a um comerciante ativo por vez. O comerciante não altera ganhos, comandas ou lançamentos pessoais do motoboy. O vínculo é protegido por RLS, com validação do convite e do estabelecimento pertencente ao motoboy. As funções usam `SECURITY INVOKER`, sem chave administrativa e sem confiar em metadados editáveis do usuário.

A conta administradora pode usar os dois perfis e vincular seu próprio estabelecimento sem cobrança. Para as demais contas, cada painel exige a assinatura correspondente; uma conta com os dois planos pode usar ambos. Com contas distintas, cada motoboy continua vendo seus dados e o comerciante recebe somente o acesso autorizado. Códigos aceitam letras maiúsculas e espaços de cópia; códigos inexistentes, vencidos e já usados geram mensagens específicas, sem tratar falhas do servidor como código inválido. Veja [planos e cobrança](billing.md).

## Entregas e acertos

O botão **Sair para entrega** registra a saída e muda o status exibido para **Em rota**. Antes disso, a entrega aparece como **Aguardando retirada**. Conclusões e cancelamentos usam o fluxo existente.

O painel atualiza a cada dez segundos enquanto está visível. Mostra as entregas do dia selecionado e todas as ainda pendentes, até 500 registros. Os contadores do dia usam o fuso de São Paulo.

O saldo acumulado por motoboy é a soma dos ganhos de entregas concluídas, menos ganhos retidos do dinheiro recebido e pagamentos registrados pelo próprio motoboy. Dinheiro de pedidos a repassar aparece separado. Gorjetas, despesas pessoais e entregas de outros estabelecimentos não são compartilhadas. Nesta versão, o comerciante acompanha os acertos; o registro do recebimento continua na área do motoboy.

## Localização

O motoboy inicia o turno, escolhe um comércio vinculado e ativa **Compartilhar localização**. O navegador pede permissão para o GPS. Uma sessão de compartilhamento separada impede que envios atrasados reativem uma sessão encerrada. Só a última posição é mantida, sem histórico de trajetos. Ao trocar o comércio vinculado, a posição anterior expira.

As posições expiram após 90 segundos sem envio. O servidor rejeita amostras de GPS com mais de 60 segundos e o painel também remove posições expiradas quando a atualização da rede falha. Encerrar o turno remove as posições e as sessões por um gatilho com as permissões do próprio motoboy. Desvincular encerra imediatamente o acesso futuro do comércio.

O rastreamento depende de HTTPS, permissão de localização, internet e app aberto. Navegadores de celular podem suspender o GPS em segundo plano ou com a tela bloqueada; esta versão não promete rastreamento contínuo nessas condições.

## Banco e verificação

Para um banco vazio, execute primeiro `supabase/schema.sql` e depois `supabase/merchant.sql`. Não reaplique esses arquivos em produção: as alterações já foram aplicadas como migrações. Tabelas de perfis comerciais, convites, vínculos e localização ficam em `giro_private`, fora da Data API exposta. Funções públicas autenticadas oferecem operações específicas e respeitam RLS.

`supabase/verify-merchant.sql` testa dois comerciantes e dois motoboys com dados fictícios em uma transação revertida: isolamento por estabelecimento, convites, proibição de edição de ganhos pelo comércio, saldos, permissões de GPS, envio atrasado, encerramento do turno e revogação. O teste também foi aprovado no projeto real do Giro.

`supabase/verify-invites.sql` verifica o vínculo dos dois perfis na mesma conta, reconexão, espaços e maiúsculas ao copiar, mensagens distintas para códigos inválidos, expirados e usados e preservação do código quando a operação é rejeitada. Os dados fictícios também são revertidos.

O assessor de segurança não apontou novos avisos. Permanece o aviso anterior de [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
