# Giro — entrega de CRO e redesign

Página: https://giro-beryl.vercel.app/conheca  
Data: 23/10/2026. Stack preservada: Next.js, React, Stripe e Supabase.

## 1. Resumo estratégico

O ângulo central é controle do turno e clareza no acerto, com uma mensagem para cada comprador.  
Motoboy: cada entrega e cada taxa no mesmo fluxo.  
Comerciante: quem está entregando e quanto falta pagar a cada um.  
A foto da comanda explica o mecanismo; a revisão preserva confiança.  
A demonstração mostra um resultado em três ações, com dados fictícios identificados.  
Os planos mostram preço, escopo, condição de entrada e renovação perto da decisão.  
O CTA fixo mantém a compra acessível no celular e some diante dos planos.  
São hipóteses de melhoria: o aumento de conversão precisa ser medido, sem percentual prometido.

### Headline do hero: 3 opções por público

| Público | Opção | Escolha |
| --- | --- | --- |
| Motoboy | **Cada entrega conta. Cada taxa também.** | Recomendada: relaciona o trabalho e o dinheiro sem prometer renda; a frase seguinte explica foto, revisão, rota e saldo. |
| Motoboy | Feche o turno sabendo o que falta receber. | Alternativa focada no fechamento; testar contra a recomendada. |
| Motoboy | Comanda, rota e taxa. Tudo no seu giro. | Alternativa mais descritiva para público que ainda não entende o produto. |
| Comerciante | **Saiba quem entrega. E quanto falta pagar.** | Recomendada: traz equipe e dinheiro para a primeira tela, as duas necessidades centrais desse comprador. |
| Comerciante | Menos “cadê?”. Mais controle de cada entrega. | Alternativa focada na interrupção do atendimento. |
| Comerciante | Entregas na tela. Acertos na mão. | Alternativa curta para criativos que já explicam o painel. |

### Como cada mudança será avaliada

| Mudança | Hipótese de conversão | Métrica principal | Verificação complementar |
| --- | --- | --- | --- |
| Hero com seletor, preço e CTA específico | O comprador identifica sua utilidade antes de rolar | CTR de compra no hero, por público | Inícios de checkout / visualizações da página |
| Dor + comparação | O cenário reconhecível aumenta interesse pelo plano | Visualizações da seção Planos / visualizações da página | Scroll 25/50/75/100 e cliques para demo |
| Demo em três ações | Entender o mecanismo reduz dúvida antes de pagar | Demo completa / demo iniciada | Início de checkout depois da interação, sem atribuir causalidade sozinho |
| Seção própria do comerciante | O dono de delivery encontra uma oferta explícita | CTR do CTA Comerciante | Compras confirmadas do plano Comerciante |
| Pacote com âncora R$ 29,90 + R$ 59,90 = R$ 89,80 | A condição de entrada fica compreensível | Compras confirmadas do pacote / visualizações elegíveis | Mix de planos; cancelamentos, estornos e dúvidas sobre renovação |
| Cancelamento perto do CTA | O visitante entende o compromisso antes de comprar | Início de checkout / clique em comprar | Compra confirmada / checkout iniciado |
| CTA fixo por público | O celular mantém uma próxima ação acessível | CTR da barra, por plano | Conversão total; evitar só transferir cliques do CTA anterior |
| FAQ curta e agrupada | As objeções são resolvidas perto da decisão | Compras / visitas que abriram FAQ | Abertura por pergunta e abandono do checkout |
| Calculadora depois dos planos | O preço é comparado à rotina depois de conhecer a oferta | Inícios de checkout após uso | Compra confirmada, sem tratar a comparação bruta como lucro |

CTR = cliques no CTA / visualizações elegíveis; com deduplicação de visita na ferramenta escolhida. Scroll até Planos deve usar `giro_view_plans`, pois a altura da página mudou. O scroll percentual é complementar.

## 2. Copy completa

A versão pronta para colar, seção por seção e com as diferenças dos dois públicos, está em **giro-copy-completa.md**. O conteúdo compartilhado entre interface e FAQ está em `lib/sales-content.ts`.

## 3. Código final e comportamento

| Arquivo | Responsabilidade |
| --- | --- |
| `app/sales-page.tsx` | Página, seletor, planos, calculadora, FAQ, CTAs e observação da barra mobile |
| `app/sales-cro.css` | Design responsivo, foco, contraste, estados e movimento reduzido |
| `app/sales-hero.tsx` | Mockups do celular e do painel, mapa ilustrativo e rótulos de dados fictícios |
| `app/sales-demo.tsx` | Simulação em três ações, resultado e CTA de compra |
| `lib/sales-content.ts` | Copy dos públicos, perguntas, benefícios e espaços de prova real |
| `lib/sales-analytics.ts` | Eventos anônimos com dimensões permitidas; sem SDK, cookies ou envio a fornecedor |
| `lib/sales-seo.ts` | Title, description, OG e Product/Offer/FAQPage sem avaliações inventadas |
| `app/conheca/page.tsx` | Renderização, JSON-LD e público inicial por parâmetro permitido |
| `app/conheca/opengraph-image.tsx` | Imagem PNG de compartilhamento, gerada e armazenada em cache pelo Next |
| `app/comprar/purchase-form.tsx` | Marca visualização, tentativa e início efetivo do checkout; fluxo de compra preservado |
| `app/compra/concluida/purchase-complete.tsx` | Marca confirmação somente depois do status verificado pelo backend |
| `tests/sales.test.mjs` | Valores, privacidade dos eventos, ofertas estruturadas e condições de produto |

Links de compra preservados: `/comprar?plano=rider`, `/comprar?plano=merchant`, `/comprar?plano=combo`. Login: `/entrar`.

Entrada de campanha para comércio: `/conheca?publico=comerciante`. A URL padrão abre Motoboy. O seletor altera headline, descrição, preço, mockup, dores, comparação, passos, demo, qualificação, CTA final e barra mobile. Não altera o preço de checkout.

O pacote continua oferecendo 1 Comerciante + 1 novo Motoboy. O comerciante cria usuário e senha do motoboy após a ativação. Não há vínculo obrigatório com loja. IA sugere; o usuário revisa. GPS permanece opcional e depende do app aberto, permissão e ativação no turno.

### Tracking implementado e limite atual

Os eventos abaixo ficam disponíveis em `window.dataLayer` e no evento `giro:analytics`. Nenhuma ferramenta de marketing ou de analytics foi adicionada. Não há UTMify. É necessário conectar um destino de analytics autorizado para visualizar relatórios de navegação e executar experimentos. A fila no navegador, sozinha, não constitui um painel de métricas.

Não são enviados e-mail, telefone, endereço, localização, ID do comprador, ID da sessão Stripe, dados da comanda ou query strings. `Do Not Track` e Global Privacy Control interrompem a emissão. As propriedades aceitas têm lista de valores e limites numéricos.

| Evento | Quando | Dimensões |
| --- | --- | --- |
| `giro_page_view` | Primeira montagem da página de vendas | Público inicial |
| `giro_cta_click` | CTA com posição identificada | Posição, plano, público, destino quando aplicável |
| `giro_audience_change` | Troca efetiva de público | Novo público |
| `giro_demo_start` | Primeira ação da demonstração | Público |
| `giro_demo_step` | Avanço da demonstração | Público e passo 1/2/3 |
| `giro_demo_complete` | Resultado após a terceira ação | Público |
| `giro_view_plans` | Planos entram no campo de visão | Público |
| `giro_calculator_use` | Usuário solta o controle ou ajusta por teclado | Plano Motoboy e taxa em centavos |
| `giro_faq_open` | Uma resposta é aberta | ID da pergunta e público |
| `giro_scroll_depth` | Primeiro alcance de 25/50/75/100% | Profundidade e público |
| `giro_checkout_view` | Formulário público de compra é exibido | Plano, método inicial e valor |
| `giro_checkout_submit` | Tentativa de abrir pagamento | Plano, método e valor |
| `giro_begin_checkout` | API devolve URL Stripe validada, antes do redirecionamento | Plano, método e valor |
| `giro_purchase_confirmed` | A página recebe confirmação verificada do backend | Método, sem identificador |

`giro_purchase_confirmed` é um sinal de navegação, emitido uma vez por montagem. Atualizar a página ou não retornar da Stripe pode alterar sua contagem. **Receita e conversão financeira devem vir do registro privado de compras pagas**, deduplicado por compra e considerando estornos/contestações. O webhook assinado continua sendo a autoridade; o evento do navegador não libera acesso.

Para a linha de base financeira, um operador autorizado pode agregar o ledger privado por dia, plano e método, sem exportar dados pessoais. Excluir testes e distinguir pagamento confirmado de e-mail enviado. Não usar QR gerado nem página de sucesso como venda.

### SEO e performance

Title, description, canonical, Open Graph, Twitter e Product/Offer/FAQPage refletem a página. O preço inicial do pacote contém a condição de renovação na descrição. Não há estrelas, avaliações nem contagem de usuários inventada. FAQPage não é uma promessa de resultado destacado no Google.

Sem vídeo em autoplay, bibliotecas de animação, imagem pesada no hero ou SDK de tracking. Mockups são HTML/CSS/SVG; a imagem OG fica fora do caminho crítico. Fontes existentes usam `display=swap`, com preconexão aos provedores já usados no projeto. O CSS antigo da segunda versão deixou de ser carregado. Layout reservado para os mockups e transições de 180ms; `prefers-reduced-motion` remove animações e transições.

**LCP inferior a 2,5s é uma meta, não uma medição certificada.** Validar com Lighthouse mobile e dados de campo após existir tráfego suficiente. CLS e INP também devem ser acompanhados. Não declarar meta cumprida a partir do build ou de uma única conexão rápida.

## 4. Placeholders e coleta de prova real

Os slots de prova social estão marcados no código e ficam sem publicação enquanto não houver material real e autorização. A seção pública atual mostra apenas uma conta demonstrável, identificada como fictícia. Não é apresentada como depoimento ou uso real de cliente.

| Espaço | Material a coletar | Como coletar e publicar |
| --- | --- | --- |
| **[PLACEHOLDER: 3 relatos autorizados de motoboys beta]** | Uma frase específica por pessoa sobre comanda, rota ou acerto | Depois de 3 turnos reais, perguntar: “O que ficou mais claro? O que ainda deu trabalho?”. Manter a fala fiel. Publicar nome, foto e cidade somente se autorizados; sem transformar observação em promessa de ganho. |
| **[PLACEHOLDER: relato autorizado de um comerciante]** | Relato sobre um acerto e o que conseguiu conferir | Acompanhar um acerto real; pedir autorização e transcrição aprovada. Sem inventar percentual de economia, entregas ou faturamento. |
| **[PLACEHOLDER: print real anonimizado do painel]** | Um exemplo real de saldo e status | Usar conta autorizada. Remover nomes de clientes, endereços, telefones, identificadores e localização. Diferenciar captura real de mockup. |
| **[PLACEHOLDER: vídeo real de 20 segundos]** | Foto → revisão → rota → saldo | Gravar com a moto parada, comanda fictícia ou autorizada e sem expor dados de clientes. Pedir consentimento específico antes de publicar imagem, voz ou operação de terceiros. |
| **[PLACEHOLDER: URL dos termos de uso revisados]** | Documento oficial de condições do serviço | Informar responsável, escopo, cobrança, renovação e canal de contato; revisão jurídica antes da publicação. O rodapé não aponta para URL inexistente. |
| **[PLACEHOLDER: URL da política de privacidade revisada]** | Documento oficial sobre tratamento de dados | Descrever de acordo com o funcionamento real, fornecedores e direitos aplicáveis. Revisão antes de publicar; não usar selo “LGPD” sem comprovação. |
| **[PLACEHOLDER: canal oficial de contato e suporte]** | E-mail, WhatsApp ou central que realmente será atendida | Confirmar o canal e os horários reais antes de anunciar. O e-mail pessoal do administrador não foi tornado público. Recuperação de acesso continua disponível em `/entrar`. |

Sem prova social real, priorizar a demonstração. Não preencher os espaços com rostos gerados, falas compostas, logos de terceiros ou números de cadastro sem auditoria.

## 5. Checklist de QA

### Verificação de implementação

- [x] 46 testes automatizados aprovados na implementação, incluindo privacidade dos eventos e condições dos planos.
- [x] Build de produção e TypeScript aprovados na implementação.
- [x] Texto e JSON-LD mantêm R$ 29,90 / R$ 59,90 / R$ 39,90 inicial / R$ 89,80 após a entrada.
- [x] IA como sugestão com revisão; limite de 40 leituras/dia e 8 paradas.
- [x] GPS opcional, app aberto e prazo de 90 segundos explicados.
- [x] Nenhum depoimento, avaliação, usuário, selo de cliente ou garantia inventado.
- [x] As URLs de compra e login foram preservadas no código.
- [x] Eventos são filtrados e não enviam dados pessoais ou query strings.
- [ ] Conferir visual em 320, 390, 768 e desktop no navegador publicado.
- [ ] Conferir as duas jornadas da demo, seletor e calculadora por teclado.
- [ ] Conferir barra mobile visível fora do hero e oculta diante dos planos.
- [ ] Conferir botões, foco visível, leitura, contraste e ausência de rolagem horizontal.
- [ ] Conferir metadata, imagem OG, dez respostas e schema no HTML publicado.
- [ ] Conferir compra pública e abertura do checkout com cartão/Pix, sem pagamento real.
- [ ] Conectar destino de analytics e conferir recebimento antes de usar relatórios ou iniciar testes A/B.
- [ ] Substituir placeholders legais e confirmar o canal oficial antes de ampliar tráfego pago.
- [ ] Medir LCP/CLS/INP em laboratório mobile e campo; ainda sem dados de campo.

Os itens de navegador serão atualizados após a publicação verificada. Aprovação de testes de código não substitui esses itens.

## 6. Plano de testes A/B prioritários

| Prioridade | A / B | Hipótese | Métrica principal | Guardrails |
| --- | --- | --- | --- | --- |
| 1 | Motoboy: “Cada entrega conta. Cada taxa também.” / “Feche o turno sabendo o que falta receber.” | A clareza sobre o fechamento pode gerar mais compras qualificadas que o ângulo geral de controle. | Compras Motoboy confirmadas / visitas elegíveis de Motoboy | CTR do hero, início de checkout, estornos e cancelamento da primeira renovação. Não trocar preço nem criativo durante o teste. |
| 2 | Pacote com âncora e condição em texto / mesma oferta com a conta visual “29,90 + 59,90 = 89,80; entrada 39,90” mais próxima do CTA | Tornar a soma visível pode aumentar compras do pacote sem criar confusão sobre o mês seguinte. | Compras do pacote confirmadas / visitas aos planos | Receita líquida, mix dos planos, dúvidas de renovação, cancelamentos e estornos. Ambos os braços exibem R$ 89,80 após a entrada. |
| 3 | CTA do hero “Começar como…” / “Assinar … por R$ …/mês” | Um CTA com preço pode reduzir cliques curiosos e melhorar a conclusão. | Compras confirmadas / visitas elegíveis | CTR, checkout iniciado, compra/checkout e experiência no celular. Mesma posição, cor e destino. |

Executar um teste por vez, sem publicar uma variante como se fosse um resultado comprovado. Divisão aleatória e estável de 50/50 por visita com uma ferramenta autorizada; evitar alternância diária ou segmentação por hora. Segmentar a análise por público, dispositivo, origem e método de pagamento quando houver volume suficiente.

Antes do teste, medir a conversão de base e definir o menor efeito que vale o esforço, tamanho da amostra, duração mínima e regra de decisão. Cobrir ao menos dois ciclos semanais completos quando viável; continuar até atingir a amostra definida, sem encerrar pelo primeiro pico. Com pouco tráfego, começar por entrevistas e observação de uso e não declarar um vencedor estatístico. Comparar compras confirmadas, não só cliques. Guardar reembolsos e cancelamentos para avaliar qualidade da venda.

### Suposições e pendências

1. A autorização anterior para melhorar e publicar o Giro na Vercel permanece válida; o repositório e o checkout atuais são preservados.
2. Motoboy é o público inicial na URL padrão; comerciantes têm seletor igualmente visível e URL dedicada por `publico=comerciante`.
3. Não há prova social validada, canal oficial de suporte ou URLs legais fornecidos. Foram reservados placeholders, sem publicar o e-mail pessoal do administrador.
4. Os campos `[PLACEHOLDER]` de prova social ficam na documentação e no código, sem depoimentos falsos na página pública. O rodapé identifica documentos/canal ainda não disponíveis.
5. Não existe medidor de analytics conectado confirmado. A instrumentação está pronta para um adaptador, sem reintroduzir a UTMify.
6. Nenhum prazo de confirmação de pagamento, entrega de e-mail, aumento de renda ou percentual de conversão é garantido.
