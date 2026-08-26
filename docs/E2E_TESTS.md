# Testes E2E

Os testes públicos cobrem home, busca, redirecionamento protegido, callback e overflow responsivo.

O fluxo autenticado está implementado em `e2e/authenticated-flow.spec.ts`. Ele cria uma conta de cliente e uma conta de consultor isoladas no banco de teste e valida booking, checkout Stripe mockado, webhook assinado, notificações, bloqueio/liberação de mensagens, Meet, report, confirmação dupla, retry idempotente de transferência, avaliação e logout/login.

Credenciais externas não são usadas em testes determinísticos. Stripe, Google Meet e Resend usam adaptadores mockados; webhook e crons continuam sendo exercitados por HTTP real.

Variáveis necessárias:

```env
E2E_SUPABASE_SERVICE_ROLE_KEY=ey...
E2E_MOCK_EXTERNALS=true
E2E_TRANSFER_MODE=fail-once
GOOGLE_MEET_ENABLED=true
CRON_SECRET=e2e-cron-secret
STRIPE_WEBHOOK_SECRET=whsec_e2e_test_secret
```

O workflow exige uma service key do projeto de teste e mantém a proteção contra o projeto de produção.
