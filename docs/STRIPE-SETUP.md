# Configuração do Stripe — fluxo oficial

## Decisão de produto

O Stripe é o único fluxo oficial de produção. O PIX manual/demonstrativo está legado e não deve confirmar pagamentos, liberar mensagens ou iniciar repasses em produção.

O código usa Stripe Checkout para cobrar o cliente e Stripe Connect Accounts v2 com configuração `recipient` para cadastrar o consultor. O dinheiro fica no saldo da plataforma e o servidor cria um `Transfer` somente após a conversa ser concluída.

## Ambiente

Configure nos ambientes local, Preview e Production:

```env
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Supabase

Aplique as migrations `20260824001000_stripe_connect_payments.sql` e `20260824001100_stripe_release_contract.sql` depois das migrations existentes.

## Webhook

Cadastre `https://SEU_DOMINIO/api/webhooks/stripe` no Stripe. Eventos usados pela aplicação:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.updated`
- `transfer.created`
- `account.updated`
- `v2.core.account.updated`

O cron `/api/cron/release-bookings` continua protegido por `CRON_SECRET` e tenta os repasses vencidos com idempotência por agendamento.

## Validação obrigatória em Test mode

Registrar evidência (ID do evento, booking e resultado) para cada cenário:

| Cenário | Resultado esperado |
|---|---|
| Checkout | sessão criada, associada ao booking e ao cliente |
| Pagamento aprovado | `Payment=PAID_HELD`, booking `CONFIRMED`, notificações e Meet/e-mail tentados |
| Pagamento recusado | `Payment=FAILED`, booking não é confirmado |
| Webhook duplicado | HTTP 200 com `duplicate=true`, sem nova transição ou notificação duplicada |
| Reembolso | `Payment=REFUNDED`; revisar/cancelar a obrigação do booking conforme política operacional |
| Disputa | `Payment=DISPUTED`, booking marcado com `disputedAt` |
| Onboarding Connect | conta criada/atualizada e capacidades de transferência ativas |
| Transferência | `Payment=RELEASED`, `stripeTransferId` e tentativa concluída |
| Retry | primeira falha fica `TRANSFER_FAILED`; retry reutiliza a chave idempotente e conclui sem transferência duplicada |

Antes do go-live, repetir essa matriz com a Stripe CLI ou Dashboard usando chaves `sk_test_`/`pk_test_`, e depois configurar o endpoint de produção com um novo segredo de assinatura. Nunca usar mocks E2E (`E2E_MOCK_EXTERNALS=true`) como evidência de aprovação Stripe.

## Confirmação dupla e retenção do saldo

A sessão Stripe cobra na plataforma, sem `transfer_data`; o valor permanece no saldo Stripe da Insidely. A aplicação só chama `transfers.create` depois que o cliente e o consultor confirmam que a conversa ocorreu. A action é idempotente e valida as duas confirmações no servidor; o primeiro clique sozinho não libera o valor.

Se uma das pessoas esquecer de confirmar, o prazo de segurança é de 24 horas depois do fim previsto da conversa. O cron transfere o valor no próximo ciclo após esse prazo, desde que não exista uma contestação. O `vercel.json` agenda o cron diariamente às 04:00 UTC, então o repasse automático pode ocorrer no próximo ciclo diário. Uma contestação mantém o pagamento retido até ser resolvida. O modo atual do checkout continua sendo `SIMULATION` e não movimenta saldo real.
