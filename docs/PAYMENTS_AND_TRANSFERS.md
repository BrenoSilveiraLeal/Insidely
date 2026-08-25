# Pagamentos e repasses

O booking nasce como `PENDING_PAYMENT`. O webhook Stripe altera o pagamento para `PAID_HELD` e o booking para `CONFIRMED`. Após a confirmação dos participantes, o booking pode ficar `COMPLETED_RELEASE_PENDING`.

O repasse usa uma chave idempotente por booking e registra cada tentativa em `TransferAttempt`. Em erro, o pagamento fica `TRANSFER_FAILED`, o booking não é concluído e o cron pode tentar novamente.

Não usar o frontend para alterar status financeiro. Toda alteração deve passar por webhook, função protegida ou job autorizado.
