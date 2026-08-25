# E-mails transacionais

O site possui integração opcional com a API do Resend. Sem as variáveis, o site continua funcionando e apenas não envia os e-mails.

Na Vercel, adicione em Production:

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Insidely <noreply@seu-dominio.com>
```

O domínio usado no remetente precisa estar verificado no Resend. O primeiro fluxo implementado envia confirmação de pagamento para cliente e profissional, incluindo o link do Google Meet quando ele já estiver disponível.
