# Conversas

Desde novembro de 2026 a Insidely tem um único formato de atendimento: o **chat pago**. Não há chamada de vídeo, horário marcado, remarcação nem pacote de perguntas. Cada chat é um `Booking` com `format = 'MESSAGE'`, um `Conversation` e mensagens em `Message`. Conversas antigas por vídeo continuam no histórico, só para consulta.

O motivo é proteger quem fala da empresa: por vídeo a pessoa é reconhecida pelo rosto e pela voz, e um empregador poderia pagar alguém para conversar com todos os funcionários cadastrados. Por chat, e com o [modo anônimo](#modo-anônimo), o consultor pode falar sem se expor. O desenho está em [superpowers/specs/2026-11-09-chat-only-anonymity-design.md](superpowers/specs/2026-11-09-chat-only-anonymity-design.md).

## Ciclo do chat

1. No perfil, o cliente clica em **Abrir chat** e vai direto ao pagamento: preço do consultor + taxa da plataforma (**20% do preço, mínimo R$ 5,00**; o consultor recebe o preço cheio, e a taxa cobre as tarifas do provedor de pagamento e a margem da Insidely). Não escreve nada antes de pagar. O pedido expira sem cobrança se não for pago em 30 minutos.
2. Pago, o chat abre na hora (`Booking.startsAt` passa a ser o momento do pagamento; `durationMinutes = 4320`, ou seja, 72 horas). O cliente escreve a primeira mensagem e, a partir daí, os dois conversam livremente.
3. O consultor tem **24 horas, contadas da primeira mensagem do cliente**, para responder. Ele pode atender vários chats ao mesmo tempo.
4. O chat é encerrado quando:
   - o cliente clica em **Minhas dúvidas foram respondidas** (depois de ao menos uma resposta): o pagamento é liberado ao consultor;
   - o consultor clica em **Encerrar conversa** (depois de ao menos uma resposta);
   - passam **24 horas sem nenhuma mensagem** de nenhum dos dois;
   - completam-se **72 horas** desde a abertura.
5. Nos três últimos casos, o valor fica retido por mais **24 horas** (`autoReleaseAt`), prazo em que o cliente pode contestar pelo próprio chat. Sem contestação, é liberado ao consultor.

O fechamento automático é feito por `close_idle_message_chats()` a cada 10 minutos (`pg_cron`), e também pela tarefa de 5 minutos (`/api/cron/reminders`), para bancos sem `pg_cron`.

## Cancelamento, expiração e reembolso

| Situação | Resultado |
| --- | --- |
| Pedido não pago em 30 minutos | Expira sem cobrança. |
| Cliente cancela antes da primeira resposta do consultor | 100% de volta (`customer_cancel_chat`). |
| Consultor recusa antes de responder | 100% de volta. |
| Consultor não responde em 24h após a primeira mensagem do cliente | Chat encerrado e 100% de volta, automaticamente. |
| Cliente pagou e não escreveu nada em 72h | Chat encerrado e 100% de volta. |
| Depois da primeira resposta | Não há cancelamento. Se as dúvidas não foram respondidas, o cliente contesta quando o chat fecha; o suporte decide entre reembolso total, parcial (o consultor recebe o restante) ou nenhum. |

Reembolsos de pagamentos simulados são feitos pelo banco; os reais (Stripe), pelo job diário `/api/cron/release-bookings` (`refundUnansweredMessageBookings`).

## Horários de atendimento

O consultor informa em **Horários** os dias e faixas em que costuma responder (`ProfessionalProfile.chatHours`, horário de Brasília). Isso é só informação: aparece no perfil como "Costuma estar online" e, dentro dessas faixas, com o selo **Disponível agora**. O chat pode ser comprado a qualquer hora. A **pausa ou férias** tira o perfil da busca e impede chats novos.

## Modo anônimo

Em **Editar perfil**, o consultor pode ativar o modo anônimo (`ProfessionalProfile.privacyMode = 'PSEUDONYM'`). Ligado, ele exige um apelido e esconde nome, sobrenome, foto, capa, faixa etária, cidade e datas exatas das experiências (as opções de `PrivacySettings`). Empresa e cargo continuam, porque são o assunto da conversa. O perfil, o cadastro e a página de privacidade avisam que usar dados reais permite que o empregador ou ex-empregador descubra quem fala da empresa. No chat, o consultor anônimo vê um lembrete para não contar detalhes que o identifiquem. A verificação de vínculo continua: o documento só a equipe vê; em público aparece apenas o selo.

## Advertências, suspensões e recursos

- **Advertência automática:** uma mensagem bloqueada no chat (contato, pagamento por fora, palavrões, ofensas ou ameaças) gera uma advertência automática, **no máximo uma a cada 24 horas**: várias tentativas no mesmo período contam como uma só (`autoWarnForChat` em `src/lib/enforcement.ts`). Advertências também podem ser dadas pela equipe ou ao aceitar uma contestação.
- **Escada:** a cada 3 advertências a conta é suspensa, por 7 dias na 1ª vez e 30 dias na 2ª. Depois de mais 3, a conta é banida (`src/lib/enforcement-policy.ts`).
- **Recurso:** a pessoa pode recorrer uma vez de cada advertência e de cada suspensão, em `/dashboard/advertencias` ou, se estiver suspensa, em `/conta-suspensa`. O suporte decide em `/admin/sancoes`. Aceito, a advertência ou a suspensão é apagada da conta, deixa de contar para as próximas e, se a suspensão estiver valendo, a conta volta na hora (`src/lib/appeals.ts`, tabela `SanctionAppeal`).

## Avaliações e histórico

- O cliente pode avaliar quando o chat termina, desde que não exista contestação e ainda não haja avaliação para aquele booking.
- Chats encerrados continuam disponíveis para consulta e suporte; ninguém envia novas mensagens.
- Ao abrir uma conversa, as mensagens recebidas são marcadas com `Message.readAt`, o que atualiza os indicadores de não lidas e o recibo visível para quem enviou.

## Implementação relacionada

- Interface e ações: `src/app/conversa/[id]/page.tsx`, `src/app/agendar/[id]/page.tsx`, `src/app/actions.ts`.
- Regras e prazos: `src/lib/booking-policy.ts`, `src/lib/chat-hours.ts`, `src/lib/stripe-payments.ts`.
- Realtime e recibos: `src/components/realtime-message-thread.tsx`, `src/lib/conversations.ts`.
- Migrations: `20261110100000_chat_only.sql`, `20261110110000_chat_pay_first.sql`, `20261110120000_auto_warnings_and_appeals.sql` e `20261110130000_chat_platform_fee.sql`.
