# Google Meet

Quando o pagamento (simulado) de uma conversa é confirmado, a aplicação cria uma sala no Google Meet com a conta Google do projeto e salva o link em `Booking.meetingUrl`. O link chega aos dois participantes por três caminhos:

- uma **mensagem automática da Insidely fixada no chat** da conversa (cliente em `/dashboard/mensagens`, consultor em `/consultor/consultas`);
- o **e-mail de confirmação** enviado ao cliente e ao consultor;
- o arquivo de calendário (`.ics`) do botão "Adicionar ao calendário".

Como uma sala do Google Meet nunca expira, o link do Meet **não é compartilhado**. Todos esses lugares mostram o link da Insidely `/sala/<id>`, que confere login, participação e horário: de 10 minutos antes até o fim da conversa, redireciona para o Meet; fora disso, mostra quando a sala abre. A tela logo após o pagamento já exibe dia, horário, link e o botão para o chat.

Cerca de 1 hora antes, os dois participantes recebem um lembrete por e-mail e no app (sininho). O `pg_cron` do Supabase chama `/api/cron/reminders` a cada 5 minutos (migration `20261016000300`); cada conversa é lembrada uma vez só, e quem pagou dentro dessa janela não recebe lembrete duplicado. O convite `.ics` do e-mail de confirmação também tem alarme 30 minutos antes. Se o Google estiver indisponível, o pagamento continua confirmado e a sala usa o link reserva `https://meet.jit.si/Insidely-<id>` (o Jitsi exige que alguém entre com login para abrir a sala).

## Google Cloud

1. No projeto `insidely` do Google Cloud Console, habilite a **Google Meet REST API**.
2. Em **Google Auth Platform → Público-alvo**, deixe o status de publicação em **Em produção**. Em "Testando", o Google invalida o refresh token a cada 7 dias e a criação de salas falha com `invalid_grant: Token has been expired or revoked`.
3. O cliente OAuth usa o redirect do OAuth Playground: `https://developers.google.com/oauthplayground` (redirects `localhost` não estão cadastrados).
4. Escopo: `https://www.googleapis.com/auth/meetings.space.created`.

Como o app não passou pela verificação do Google, a tela de autorização mostra "O Google não verificou este app" — isso só aparece para quem autoriza (a conta do projeto) e não afeta os usuários do site.

## Gerar ou renovar o refresh token

1. Abra o [OAuth Playground](https://developers.google.com/oauthplayground), clique na engrenagem e marque **Use your own OAuth credentials** com o `GOOGLE_CLIENT_ID` e o `GOOGLE_CLIENT_SECRET`.
2. Em "Input your own scopes", informe o escopo acima, autorize com a conta do projeto e troque o código por tokens.
3. Copie o **refresh token** e grave-o na Vercel (Production) como `GOOGLE_REFRESH_TOKEN`; depois faça um redeploy.

## Variáveis na Vercel

```text
GOOGLE_MEET_ENABLED=true
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

Nunca use o prefixo `NEXT_PUBLIC_` nessas variáveis nem as coloque no Git. Espaços e quebras de linha no fim dos valores são ignorados.

## Diagnóstico

- Os logs da Vercel mostram `google_meet_creation_failed` com o motivo (por exemplo `Google OAuth failed: 400` para token vencido).
- `/api/cron/create-meetings` é um endpoint protegido por `CRON_SECRET` que tenta criar salas para conversas confirmadas sem link.
