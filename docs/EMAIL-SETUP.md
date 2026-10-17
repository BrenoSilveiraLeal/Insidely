# E-mails transacionais

A aplicação envia estes e-mails:

| E-mail | Quando | Para |
|---|---|---|
| Confirmação de cadastro | ao criar a conta com e-mail e senha | quem se cadastrou |
| Redefinição de senha | em "Esqueci minha senha" | dono da conta |
| Finalize o pagamento | ao reservar um horário | cliente |
| Conversa confirmada (link da sala, convite de calendário) | ao confirmar o pagamento | cliente e consultor |
| Lembrete da conversa | cerca de 1 hora antes (via `pg_cron`) | cliente e consultor |
| Conversa cancelada | quando o consultor cancela | cliente |

## Remetente de marca: Resend

A produção usa o Resend com o remetente verificado `Insidely <noreply@insidely.com>`. Quando `RESEND_API_KEY` e `RESEND_FROM_EMAIL` estão configurados, a aplicação usa esse remetente antes de qualquer SMTP. Isso impede que credenciais pessoais do Gmail sobrescrevam a identidade da Insidely.

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Insidely <noreply@insidely.com>
```

O domínio do remetente precisa estar verificado no Resend; caso contrário, a API responde `403` e nada é enviado (os logs mostram `Resend failed: 403`). O SMTP do Supabase também está configurado para usar o Resend e o remetente `noreply@insidely.com`, com nome de exibição `Insidely`.

### SMTP de contingência

O SMTP da aplicação só é usado localmente durante o desenvolvimento, se o Resend não estiver configurado. Na produção e nas prévias da Vercel, o código não recorre ao SMTP pessoal caso o Resend esteja indisponível. Não use uma conta Gmail pessoal como SMTP em produção: o Gmail pode reescrever o remetente com o endereço pessoal da conta. Se configurar outro SMTP local, use somente um endereço autorizado pelo provedor:

```text
SMTP_HOST=
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Insidely <noreply@insidely.com>
```

O pagamento da versão acadêmica é simulado: nenhum e-mail contém código Pix ou dados de cobrança reais.

## Endereço de resposta

O remetente verificado que está funcionando na produção é `Insidely <noreply@insidely.com>`. `admin@insidely.vercel.app` não pode ser usado pelo provedor enquanto o domínio `vercel.app` não puder ser verificado por quem envia os e-mails; tentar usá-lo sem verificação pode fazer as mensagens serem rejeitadas. Para receber respostas, configure uma caixa ou alias em um domínio que a Insidely controle.
