# Bloqueios externos

## 2026-08-25

### GitHub

O ambiente não conseguiu conectar ao GitHub para comparar `origin/main` com o commit local. O remote está configurado, mas a confirmação do commit remoto deve ser feita com:

```bash
git fetch origin main
git rev-parse origin/main
```

### Vercel

O deploy de produção observado estava no commit `e834cf2`, anterior às correções de agendamento e notificações. O deploy final depende de confirmar o branch remoto e promover o commit correto.

### Stripe

Não há autorização para declarar pagamento ou transferência real sem uma resposta real da API Stripe. Os testes locais devem usar mocks determinísticos.

### Google Meet

A integração exige `GOOGLE_MEET_ENABLED`, credenciais OAuth e refresh token válidos. Sem eles, a criação real não pode ser validada.

### E-mail

O envio depende de `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. Sem essas variáveis, a aplicação deve registrar o estado pendente e continuar o fluxo principal.
