# Configuração do Stripe

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
