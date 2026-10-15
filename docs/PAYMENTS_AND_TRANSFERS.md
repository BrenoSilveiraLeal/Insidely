# Pagamentos e repasses

O booking nasce como `PENDING_PAYMENT`. O webhook Stripe altera o pagamento para `PAID_HELD` e o booking para `CONFIRMED`. Após a confirmação dos participantes, o booking pode ficar `COMPLETED_RELEASE_PENDING`.

O repasse usa uma chave idempotente por booking e registra cada tentativa em `TransferAttempt`. Em erro, o pagamento fica `TRANSFER_FAILED`, o booking não é concluído e o cron pode tentar novamente.

Não usar o frontend para alterar status financeiro. Toda alteração deve passar por webhook, função protegida ou job autorizado.

## Modo de demonstração

O checkout acadêmico apresenta Pix, crédito, débito e boleto com dados fictícios. A confirmação grava provider = SIMULATION, não coleta informações de cartão e não movimenta dinheiro. Depois que os dois participantes confirmam o fim, a reserva simulada passa a COMPLETED e o pagamento fica RELEASED para habilitar avaliações e ganhos. A taxa da plataforma aparece separada do valor da conversa.

Stripe Connect e webhooks permanecem disponíveis quando as credenciais são configuradas; elas não são necessárias para demonstrar o fluxo simulado.
