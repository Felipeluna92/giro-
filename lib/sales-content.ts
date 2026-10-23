export type SalesAudience = 'rider' | 'merchant';

export const salesCopy = {
 rider: {
  label: 'Motoboy', eyebrow: 'PARA QUEM FAZ O CORRE',
  headline: 'Cada entrega conta.', emphasis: 'Cada taxa também.',
  description: 'Foto da comanda, dados conferidos, rota organizada e saldo do turno. Seu corre no controle, mesmo sem loja vinculada.',
  cta: 'Começar como motoboy', price: 2990,
  painTitle: 'O turno acaba. A conta continua?',
  pains: [
   ['“Essa taxa eu anotei onde?”', 'Uma no caderninho. Outra perdida na conversa.'],
   ['“Qual endereço vem agora?”', 'Mais de uma comanda e tudo espalhado no celular.'],
   ['“O total do pedido é meu ganho?”', 'Dinheiro do cliente misturado com a sua taxa.'],
   ['“Quanto ainda falta receber?”', 'O dia termina e o acerto vira conta de cabeça.'],
  ],
  comparison: [
   ['Taxa espalhada no papel e no WhatsApp.', 'Taxa junto de cada entrega salva.'],
   ['Endereço e telefone em lugares diferentes.', 'Cliente, endereço e contato na mesma entrega.'],
   ['Várias comandas para organizar na cabeça.', 'Sequência organizada com até 8 paradas.'],
   ['Somar tudo de novo no fim do turno.', 'Ganhos, despesas e saldo para conferir.'],
  ],
  steps: [
   ['Fotografe. Depois confira.', 'A IA sugere cliente, endereço, telefone e taxa. Você revisa e salva.', 'Até 40 leituras por IA por dia.'],
   ['Organize e faça as entregas.', 'Reúna até 8 paradas e confira a sequência. O contato fica junto do pedido.', 'Tudo no navegador do celular.'],
   ['Feche o turno com os valores na mão.', 'Veja entregas concluídas, registre despesas e confira o que falta receber.', 'Dinheiro do pedido separado do ganho.'],
  ],
  forYou: ['Faz entregas por conta própria ou para uma ou mais lojas.', 'Quer conferir comandas, taxas e saldo no mesmo lugar.'],
  notForYou: ['Precisa trabalhar sem conexão à internet.', 'Procura leitura sem revisão ou promessa de renda.'],
  finalTitle: 'O corre é seu.', finalEmphasis: 'O controle também pode ser.',
  finalDescription: 'Comece pela próxima comanda. Termine o turno com os valores para conferir.',
 },
 merchant: {
  label: 'Comerciante', eyebrow: 'PARA QUEM TOCA O DELIVERY',
  headline: 'Saiba quem entrega.', emphasis: 'E quanto falta pagar.',
  description: 'Entregas por status, última localização autorizada e saldo de taxas por motoboy. Seu delivery e os acertos no mesmo painel.',
  cta: 'Começar como comerciante', price: 5990,
  painTitle: 'Seu delivery depende de perguntar tudo?',
  pains: [
   ['“Cadê o motoboy?”', 'Mais uma mensagem no meio do atendimento.'],
   ['“Esse pedido já saiu?”', 'Retirada, rota e conclusão se perdem na conversa.'],
   ['“Quanto eu devo para cada um?”', 'Taxas e pagamentos espalhados até o dia do acerto.'],
   ['“Esse dinheiro é do pedido ou da taxa?”', 'Valores misturados viram dúvida para os dois lados.'],
  ],
  comparison: [
   ['Perguntar o status de cada pedido.', 'Entregas por status e por motoboy no painel.'],
   ['Pedir a localização por mensagem.', 'Última posição que o motoboy autorizou compartilhar.'],
   ['Refazer a conta de cada entregador.', 'Taxas e saldo a pagar por motoboy.'],
   ['Misturar acerto e dinheiro dos pedidos.', 'Valores separados para conferir o acerto.'],
  ],
  steps: [
   ['Convide. A equipe aceita.', 'Conecte o comércio aos motoboys por convite aceito. Cada um mantém sua conta.', 'O vínculo é uma escolha dos dois.'],
   ['Acompanhe cada etapa.', 'Veja o que aguarda retirada, está em rota ou foi concluído por cada motoboy.', 'GPS apenas quando autorizado.'],
   ['Confira antes de acertar.', 'Consulte taxas, pagamentos registrados e saldo de cada motoboy.', 'Acerto separado do dinheiro dos pedidos.'],
  ],
  forYou: ['Tem um comércio ou delivery e quer acompanhar a equipe conectada.', 'Quer conferir status e o saldo de cada motoboy antes do acerto.'],
  notForYou: ['Precisa de rastreamento com o app fechado ou a tela bloqueada.', 'Busca acompanhar uma equipe sem convite aceito e autorização.'],
  finalTitle: 'Seu delivery em movimento.', finalEmphasis: 'Seu acerto no controle.',
  finalDescription: 'Veja as entregas da equipe conectada e confira o saldo de cada motoboy.',
 },
} as const;

export const salesFaq = [
 {id:'mais-um-app',group:'Começar',question:'É só mais um app para eu cuidar?',answer:'O Giro reúne o que hoje fica espalhado. Comandas, endereços, taxas e fechamento ficam no mesmo fluxo. Use a demonstração em 3 toques e veja se faz sentido para o seu turno. Você usa pelo navegador e pode adicionar à tela inicial.'},
 {id:'loja',group:'Começar',question:'Meu comerciante precisa assinar também?',answer:'Não. O plano Motoboy funciona sozinho, sem loja vinculada. Você pode apresentar o Giro a um comércio onde trabalha. Para usar o painel de equipe, o comerciante precisa do próprio plano; conectar as contas continua opcional.'},
 {id:'internet',group:'Começar',question:'Preciso de internet boa?',answer:'Você precisa de conexão para usar o Giro. Uma conexão estável ajuda a enviar fotos e atualizar entregas e localização. Não há promessa de funcionamento sem internet. Você pode usar direto no navegador do celular.'},
 {id:'acesso',group:'Pagamento',question:'Como recebo meu acesso e defino a senha?',answer:'O acesso chega por e-mail após o pagamento confirmado. Escolha o plano, informe o e-mail na compra e abra o link para definir a senha. Se já tem conta, use o mesmo e-mail; sua senha atual permanece válida. No pacote, o comerciante cria o usuário e a senha do novo motoboy, que entra sem e-mail.'},
 {id:'pacote',group:'Pagamento',question:'O pacote custa R$ 39,90 todo mês?',answer:'Não. R$ 39,90 é o valor do primeiro mês, uma vez por conta compradora. Depois, o pacote custa R$ 89,80/mês e inclui 1 conta Comerciante + 1 conta Motoboy. No Pix, são R$ 39,90 nos primeiros 30 dias e R$ 89,80 nas renovações de 30 dias.'},
 {id:'cancelamento',group:'Pagamento',question:'Como pago, renovo e cancelo?',answer:'Você paga pela Stripe, com cartão ou Pix quando disponível. No cartão, a renovação é mensal; cancele a próxima em “Gerenciar assinatura” e mantenha o período já pago. No Pix, cada pagamento libera 30 dias, sem débito automático. Para renovar e preservar dias restantes do mesmo plano, use o mesmo e-mail.'},
 {id:'ia',group:'IA',question:'E se a IA errar a comanda?',answer:'Você confere e corrige antes de salvar. A IA sugere os dados da foto; não confirma uma entrega por você. Uma foto nítida ajuda. Se um campo estiver ilegível, preencha manualmente.'},
 {id:'limites',group:'IA',question:'Quantas comandas e paradas posso usar?',answer:'O plano Motoboy inclui até 40 leituras de comanda por IA por dia. Cada rota pode ter até 8 paradas. Os mesmos limites valem para a conta Motoboy incluída no pacote.'},
 {id:'gps',group:'GPS',question:'A localização funciona com a tela bloqueada?',answer:'Não conte com atualização com a tela bloqueada ou o app em segundo plano. O Giro precisa estar aberto, com localização autorizada e compartilhamento ativado pelo motoboy durante o turno. Após 90 segundos sem atualização, a posição deixa de ser marcada como atual.'},
 {id:'privacidade',group:'Privacidade',question:'Quem vê meus dados e minha localização?',answer:'O comerciante vê entregas e acertos dos vínculos aceitos. Despesas pessoais e entregas de outros locais ficam fora desse compartilhamento. Localização é opcional: o motoboy decide ativar o compartilhamento no turno e precisa autorizar o GPS no celular. Use sempre com a moto parada.'},
] as const;

export const riderBenefits = ['Cliente, endereço, telefone e taxa juntos', 'Até 40 leituras de comanda por IA/dia, com sua revisão', 'Rotas com até 8 paradas', 'Ganhos, despesas e fechamento do turno', 'Use sozinho, sem vincular uma loja'];
export const merchantBenefits = ['Equipe conectada por convite aceito', 'Entregas por status e por motoboy', 'Última localização autorizada durante o turno', 'Taxas e saldo a pagar por motoboy', 'Acertos separados do dinheiro dos pedidos'];

// [PLACEHOLDER: 3 relatos reais de motoboys beta, com autorização de publicação.]
// [PLACEHOLDER: 1 relato de comerciante sobre um acerto, sem prometer economia.]
// [PLACEHOLDER: print real anonimizado e vídeo real de 20s, com uso autorizado.]
// These slots stay unpublished until real evidence and permission are available.
export const proofPlaceholders = [
 {slot:'motoboy',placeholder:'[PLACEHOLDER: 3 relatos autorizados de motoboys beta]',collect:'Depois de 3 turnos de uso, pergunte o que ficou mais claro e o que ainda deu trabalho. Publique a fala fiel, com nome e cidade apenas se autorizados.'},
 {slot:'comerciante',placeholder:'[PLACEHOLDER: relato autorizado de um comerciante]',collect:'Acompanhe um acerto real e peça um relato curto. Não transforme percepção em número de economia.'},
 {slot:'produto',placeholder:'[PLACEHOLDER: print real anonimizado + vídeo real de 20 segundos]',collect:'Grave foto, revisão e saldo com a moto parada. Use comanda fictícia ou autorizada; remova nomes de clientes, endereços, telefones e localização.'},
] as const;

export function feeEquivalent(priceCents:number,feeCents:number){
 if(!Number.isSafeInteger(priceCents)||priceCents<=0||!Number.isSafeInteger(feeCents)||feeCents<=0)return null;
 return priceCents/feeCents;
}
