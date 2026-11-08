# Insidely

Marketplace de conversas profissionais para conhecer empresas e profissões antes de tomar decisões de carreira. O produto conecta clientes a consultores por videochamada ou por perguntas respondidas no chat.

**Stack:** Next.js 16 · React 19 · TypeScript · Supabase · Vercel

> O checkout atualmente é demonstrativo: não cobra nem movimenta dinheiro real. A integração Stripe existente no código não está ativa no fluxo de checkout atual.

## O produto

- **Busca de profissionais:** página responsiva com palavra-chave, empresa, profissão e modalidade, além de filtros por preço, avaliação, senioridade, disponibilidade, vínculo e ordenação. Resultados e contadores vêm do banco de dados.
- **Conversas por vídeo:** reserva de horário, chat protegido, sala Google Meet no horário marcado e confirmação após o encontro.
- **Perguntas por mensagem:** pedido de uma a cinco perguntas; o consultor responde uma de cada vez dentro de 48 horas.
- **Confiança e suporte:** identificação por CPF e idade mínima, moderação do chat, bloqueios, denúncias, contestações e histórico preservado.
- **Painéis separados:** áreas para clientes, consultores e administração, com notificações, agenda e controles de privacidade.

Veja os estados e as regras de cada formato em [docs/CONVERSATIONS.md](docs/CONVERSATIONS.md).

## Começar localmente

### Requisitos

- Node.js 24 LTS (`.nvmrc`)
- npm 10 ou mais recente
- Projeto Supabase

### Instalação

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Preencha no mínimo `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. O arquivo `.env.example` lista as integrações opcionais. Nunca coloque a chave `service_role` em uma variável `NEXT_PUBLIC_*`.

## Banco de dados e migrations

`supabase/baseline/schema.sql` é o snapshot do esquema-base. Para um projeto novo, aplique o baseline e as migrations incrementais na ordem. Para o projeto Supabase já conectado, confira o histórico remoto antes de aplicar alterações: migrations antigas foram registradas por caminhos diferentes e um `db push` direto pode tentar reaplicar versões existentes.

Procedimento usado para aplicar uma migration isoladamente:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db query --linked -f supabase/migrations/<arquivo>.sql
npx supabase migration repair --status applied <versao> --linked
```

Consulte [docs/DEPLOY.md](docs/DEPLOY.md) e o histórico em `supabase/migrations`. A Edge Function de exclusão de conta fica em `supabase/functions/delete-account` e é publicada com:

```bash
npx supabase functions deploy delete-account
```

## Integrações opcionais

- **Google Meet:** `GOOGLE_MEET_ENABLED`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`. Veja [docs/GOOGLE-MEET-SETUP.md](docs/GOOGLE-MEET-SETUP.md).
- **E-mail:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, ou Resend com `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. Veja [docs/EMAIL-SETUP.md](docs/EMAIL-SETUP.md).
- **Stripe:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. O checkout atual permanece demonstrativo. Veja [docs/STRIPE-SETUP.md](docs/STRIPE-SETUP.md) e [docs/PAYMENTS_AND_TRANSFERS.md](docs/PAYMENTS_AND_TRANSFERS.md).
- **Web push:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` habilitam notificações push no navegador.
- **Moderação avançada de imagem:** `OPENAI_API_KEY`; as validações locais continuam ativas sem ela.
- **Tarefas agendadas:** `/api/cron/*` usa `CRON_SECRET` quando configurado. Consulte [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md).

O login social usa Supabase Auth. Opcionalmente, `GOOGLE_LOGIN_CLIENT_ID` e `GOOGLE_LOGIN_CLIENT_SECRET` configuram o OAuth Google pelo próprio site: cadastre `<APP_URL>/auth/google/callback` como redirect no cliente OAuth e inclua o Client ID na configuração do provedor Google no Supabase. Sem essas variáveis, o fluxo usa o OAuth do Supabase.

## Estrutura do repositório

| Caminho | Conteúdo |
| --- | --- |
| `src/app` | Rotas, páginas, API routes e Server Actions. |
| `src/components` | Componentes de interface, incluindo componentes client. |
| `src/lib` | Políticas de domínio, sessão, consultas e integrações. |
| `supabase/migrations` | Evolução incremental do banco, RPCs, triggers e RLS. |
| `supabase/functions` | Edge Functions. |
| `docs` | Guias operacionais, segurança, pagamentos, QA e arquitetura. |
| `e2e` | Cenários automatizados com Playwright. |

A visão das fronteiras e do fluxo de dados fica em [ARCHITECTURE.md](ARCHITECTURE.md).

## Comandos úteis

```bash
npm run db:health       # verifica a Data API configurada
npx tsc --noEmit        # checagem de tipos
npm run lint            # ESLint
npm test                # testes unitários
npm run build           # build de produção
npm run test:e2e        # Playwright
```

Os testes autenticados usam duas contas configuradas no ambiente E2E. Consulte [docs/E2E_TESTS.md](docs/E2E_TESTS.md) antes de executá-los.

## Documentação

| Documento | Assunto |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Camadas, autorização, dados e rotas principais. |
| [docs/CONVERSATIONS.md](docs/CONVERSATIONS.md) | Ciclo de vídeo e perguntas por mensagem. |
| [ROADMAP.md](ROADMAP.md) | Entregas atuais e próximos pontos operacionais. |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Ordem de publicação e verificação de deployment. |
| [docs/PAYMENTS_AND_TRANSFERS.md](docs/PAYMENTS_AND_TRANSFERS.md) | Simulação atual e integração financeira prevista. |
| [docs/SUPABASE_SECURITY_REVIEW.md](docs/SUPABASE_SECURITY_REVIEW.md) | RLS, RPCs, views e dados sensíveis. |
| [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) | Crons, alertas e monitoramento. |
| [docs/E2E_TESTS.md](docs/E2E_TESTS.md) | Preparação e execução dos fluxos E2E. |
| `docs/QA_*.md` | Relatórios de QA feitos em datas específicas; leia a data antes de tratar um resultado como atual. |

## Segurança

- RLS permanece habilitado; identidade e papel são resolvidos no servidor a partir da sessão autenticada.
- Dados de identidade e documentos de verificação não são expostos em views públicas.
- RPCs privilegiadas validam autorização e revogam execução de `PUBLIC` e `anon`.
- Views públicas devem expor somente os campos aprovados para o perfil público. Revise privacidade antes de acrescentar colunas.
- Nunca execute pagamentos, reembolsos ou alterações financeiras no navegador.
