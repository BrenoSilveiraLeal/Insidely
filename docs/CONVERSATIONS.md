# Conversas

A Insidely tem dois formatos de atendimento. Ambos criam um `Booking`, um `Conversation` e mensagens persistidas em `Message`; início, encerramento e confirmação variam conforme o formato.

## Vídeo

1. O cliente escolhe um horário e o horário fica reservado só para ele por **5 minutos** (some das opções de outras pessoas). Se o pagamento for concluído nesse prazo, a conversa é confirmada; se não, a reserva expira e o horário volta ao perfil. O banco expira reservas a cada minuto (`pg_cron`, migration `20261109120000_slot_hold_5_minutes.sql`), e o perfil público também limpa as vencidas ao ser aberto. Pedidos de perguntas por mensagem não têm horário e mantêm 30 minutos. Prazos em `src/lib/booking-policy.ts`.
2. O chat abre 24 horas antes do horário marcado. A sala do Google Meet abre no início e fecha ao final da duração.
3. Depois do fim, cliente e consultor podem confirmar que a conversa aconteceu. O cliente pode avaliar a partir do fim do horário, sem depender da liberação do repasse.
4. Uma contestação mantém o caso para análise e bloqueia a conclusão financeira automática.

## Perguntas por mensagem

1. O cliente escreve uma apresentação opcional e de uma a cinco perguntas no pedido. Não envia novas mensagens pelo chat depois do pagamento.
2. Quando o pagamento é confirmado, a apresentação e a primeira pergunta chegam ao chat. O consultor tem 48 horas para responder.
3. Depois de responder a pergunta atual, o consultor libera a próxima pelo botão **Enviar próxima pergunta**. Uma mensagem de apresentação ou saudação não conta como resposta.
4. Após a resposta à última pergunta, o consultor pode publicar a mensagem automática de encerramento e finalizar o atendimento. O pedido passa a aguardar confirmação; o valor fica retido por 24 horas para uma possível contestação.
5. Depois que todas as perguntas foram respondidas, o cliente também pode usar **Minhas dúvidas foram respondidas**. A ação registra a confirmação do cliente e encerra o envio de mensagens. O histórico continua disponível.
6. Se nenhuma resposta do consultor chegar dentro de 48 horas, o pedido é cancelado e o valor é devolvido integralmente.

Os estados e as validações são aplicados no servidor e no banco. A interface só mostra a ação de encerramento do cliente quando todas as perguntas foram enviadas e a última foi respondida.

## Avaliações e histórico

- A avaliação do cliente fica disponível quando o horário/duração da conversa terminou, desde que não exista contestação e ainda não haja avaliação para aquele booking.
- Conversas encerradas ficam disponíveis para consulta e suporte. O chat deixa de aceitar mensagens conforme o estado e o formato do booking.
- Ao abrir uma conversa, as mensagens recebidas são marcadas com `Message.readAt`; isso atualiza os indicadores de mensagens não lidas e o recibo visível para quem enviou.
- Notificações que apontam para a conversa são marcadas como lidas ao abrir o respectivo chat.

## Implementação relacionada

- Interface e ações: `src/app/conversa/[id]/page.tsx`, `src/app/actions.ts`.
- Realtime e recibos: `src/components/realtime-message-thread.tsx`, `src/lib/conversations.ts`.
- Políticas de horário e avaliação: `src/lib/booking-policy.ts`.
- Migrations centrais: `20261029120000_review_after_conversation_ends.sql`, `20261030090000_conversation_reads.sql`, `20261030120000_message_read_receipts.sql`, `20261101108000_message_single_question.sql`, `20261101110000_message_questions.sql`, `20261101111000_message_questions_one_by_one.sql` e `20261101115000_next_question_button.sql`.

## Advertências, suspensões e banimento

A cada 3 advertências a conta é suspensa: 7 dias na 1ª vez e 30 dias na 2ª. Depois de mais 3 advertências, a conta é banida. O histórico fica na conta e só o suporte e a administração veem. A regra está em `src/lib/enforcement-policy.ts` e é aplicada por `src/lib/enforcement.ts`; os mesmos números aparecem nos Termos de serviço. Admin registra pelas telas de usuários; o suporte, por `/admin/sancoes` (sem acesso a CPF, sem agir em contas da equipe e sem encerrar suspensões).
