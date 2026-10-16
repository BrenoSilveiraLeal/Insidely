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

## Configuração recomendada: Gmail SMTP

Funciona sem domínio próprio e entrega para qualquer endereço (limite do Gmail: cerca de 500 envios por dia).

1. Na conta Google remetente, ative a verificação em duas etapas.
2. Crie uma senha de app em https://myaccount.google.com/apppasswords (nome: Insidely).
3. Na Vercel (Production), configure e faça um redeploy:

```text
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=seu-email@gmail.com
SMTP_PASS=<senha de app de 16 letras>
SMTP_FROM=Insidely <seu-email@gmail.com>
```

Com o SMTP configurado, os links de **cadastro** e de **redefinição de senha** também são gerados pela aplicação (Supabase Admin `generateLink`) e enviados por esse SMTP. O link aponta para `/auth/confirm?token_hash=...`, que valida o token, cria o perfil e leva ao onboarding (ou à troca de senha). Links usados ou vencidos mostram um aviso na tela de login. Assim o cadastro não depende do envio de e-mail do próprio Supabase, que só entrega para membros da equipe do projeto.

## Alternativa: Resend

Se `SMTP_*` não estiver configurado, a aplicação usa o Resend:

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Insidely <noreply@seu-dominio.com>
```

O domínio do remetente precisa estar verificado no Resend; caso contrário, a API responde `403` e nada é enviado (os logs mostram `Resend failed: 403`). Sem SMTP, os e-mails de cadastro voltam a ser enviados pelo Supabase, que então precisa de um SMTP próprio em Authentication → SMTP Settings.

O pagamento da versão acadêmica é simulado: nenhum e-mail contém código Pix ou dados de cobrança reais.
