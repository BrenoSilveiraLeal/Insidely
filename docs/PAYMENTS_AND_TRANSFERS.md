# Pagamentos e repasses

## Fluxo real previsto (Stripe)

O booking nasce como `PENDING_PAYMENT`. O checkout Stripe cobra o cliente na plataforma; sem `transfer_data`, o dinheiro fica no saldo Stripe da Insidely. O webhook registra `Payment=PAID_HELD` e `Booking=CONFIRMED`. O saldo não é transferido ao consultor quando o pagamento é aprovado.

Depois que a conversa acontece, cliente e consultor podem confirmar pelo aplicativo. A transferência ao consultor só pode começar quando ambos os campos de confirmação estiverem preenchidos. A primeira confirmação isolada não autoriza o repasse. Se os dois confirmarem, a transferência Stripe é iniciada imediatamente, com uma chave idempotente por booking.

Se alguém não confirmar, o prazo automático é 24 horas após o fim previsto da conversa. Sem contestação aberta, o cron inicia a transferência depois desse prazo. Se houver contestação, o valor continua retido até a análise. O cron atual roda diariamente às 04:00 UTC; por isso, a operação automática ocorre no primeiro ciclo depois que o prazo de 24 horas vence. Falhas de transferência ficam em `TRANSFER_FAILED` e podem ser tentadas novamente sem duplicar o repasse.

A confirmação da conversa não libera avaliações/ganhos antes das regras de conclusão e a plataforma não deve executar transferências no frontend. Toda transferência real acontece no servidor via `releaseBookingTransfer`.

## Simulação acadêmica atual

A simulação não cobra, retém, transfere nem devolve dinheiro real. Ela grava estados demonstrativos para mostrar o fluxo. Duas confirmações concluem a simulação imediatamente. Se não houver confirmação, um processo automático marca o repasse demonstrativo como liberado depois do mesmo prazo de segurança de 24 horas, desde que não haja contestação. A migration `booking_release_policy` restringe os jobs demonstrativos a `provider=SIMULATION`, evitando que o SQL marque um pagamento Stripe como transferido sem criar uma `Transfer`.

## Cancelamentos

Se o consultor cancela antes da conversa, o cliente recebe reembolso integral. Se o cliente cancela com mais de 24 horas de antecedência, recebe 100% de volta; dentro das 24 horas anteriores ao início, recebe 90%, com taxa de cancelamento de 10%. O reembolso real Stripe é solicitado para o meio de pagamento original e usa uma chave idempotente por booking.

## Estados financeiros

- `PENDING`: pagamento ainda não concluído.
- `PAID_HELD` / `HELD`: pago e retido na plataforma.
- `TRANSFER_PROCESSING`: transferência ao consultor em andamento.
- `TRANSFER_FAILED`: transferência falhou e pode ser repetida.
- `RELEASED`: simulação concluída ou transferência real concluída; para Stripe, requer `stripeTransferId`.
- `REFUNDED`: reembolso processado/iniciado no provedor.

Não usar o frontend para alterar estados financeiros. Alterações reais passam por webhook, função protegida ou job autorizado.
