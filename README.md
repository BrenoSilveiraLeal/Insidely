# Insidely

Marketplace de conversas profissionais para conhecer empresas e profissões antes de tomar decisões de carreira. O produto conecta clientes a consultores (funcionários atuais ou ex-funcionários) por um **chat pago**, com a opção de o consultor aparecer de forma **anônima**.

**Stack:** Next.js 16 · React 19 · TypeScript · Supabase · Vercel

> O checkout atualmente é demonstrativo: não cobra nem movimenta dinheiro real. A integração Stripe existente no código não está ativa no fluxo de checkout atual.

## O produto

- **Busca de profissionais:** página responsiva com palavra-chave, empresa, profissão e modalidade, além de filtros por preço, avaliação, senioridade, vínculo e ordenação. Resultados e contadores vêm do banco de dados.
- **Chat pago, sem horário marcado:** o cliente paga para liberar o chat, que abre na hora. O consultor tem 24 horas para responder depois da primeira mensagem do cliente e pode atender vários chats ao mesmo tempo. O chat fecha quando o cliente confirma que as dúvidas foram respondidas, quando o consultor encerra, após 24 horas sem mensagens ou em 72 horas.
- **Preço e taxa:** o consultor define o valor do chat. A Insidely soma uma taxa de **20% sobre esse valor, com mínimo de R$ 5,00**, que cobre as tarifas do provedor de pagamento (por exemplo, o Stripe) e deixa a margem da plataforma. O cliente paga valor + taxa; o consultor recebe o valor cheio. Exemplo: chat de R$ 30, cliente paga R$ 36, consultor recebe R$ 30. A regra fica em `chatFeeCents` (`src/lib/booking-policy.ts`) e em `chat_fee_cents` no banco.
- **Pagamento protegido:** o valor fica retido até o chat terminar. Sem resposta do consultor, o cliente recebe 100% de volta. Antes da primeira resposta, o cliente pode cancelar com reembolso integral; depois, pode contestar, e o suporte decide entre reembolso total, parcial ou nenhum.
- **Modo anônimo:** o consultor pode aparecer só com um apelido, a empresa e o cargo, para que o empregador ou ex-empregador não descubra quem fala da empresa. A verificação de vínculo continua, visível só para a equipe.
- **Confiança e suporte:** identificação por CPF e idade mínima, moderação do chat com advertência automática (no máximo uma a cada 24 horas), suspensões progressivas, recurso contra advertências e suspensões, bloqueios, denúncias, contestações e histórico preservado.
- **Painéis separados:** áreas para clientes, consultores, suporte e administração, com notificações, horários de atendimento e controles de privacidade.

> Até novembro de 2026 a plataforma também tinha conversas por vídeo (Google Meet) e um formato de "5 perguntas por mensagem". Os dois foram removidos depois da apresentação do TCC: por vídeo o consultor é reconhecido pelo rosto e pela voz, o que o expõe a retaliação. Conversas antigas continuam no histórico.

Veja o ciclo completo do chat, os prazos e as regras de reembolso, anonimato e advertências em [docs/CONVERSATIONS.md](docs/CONVERSATIONS.md).

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

As migrations do formato só por chat são `20261110100000_chat_only.sql`, `20261110110000_chat_pay_first.sql`, `20261110120000_auto_warnings_and_appeals.sql` e `20261110130000_chat_platform_fee.sql`, aplicadas nessa ordem. Elas agendam o fechamento automático dos chats com `pg_cron`, quando a extensão existe.

Consulte [docs/DEPLOY.md](docs/DEPLOY.md) e o histórico em `supabase/migrations`. A Edge Function de exclusão de conta fica em `supabase/functions/delete-account` e é publicada com:

```bash
npx supabase functions deploy delete-account
```

## Integrações opcionais

- **E-mail:** `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, ou Resend com `RESEND_API_KEY` e `RESEND_FROM_EMAIL`. Veja [docs/EMAIL-SETUP.md](docs/EMAIL-SETUP.md).
- **Stripe:** `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. O checkout atual permanece demonstrativo. A taxa de 20% foi pensada para cobrir as tarifas do Stripe (cartão e Pix) e ainda deixar lucro; se o provedor mudar no futuro, a porcentagem pode ser reavaliada com os custos reais. Veja [docs/STRIPE-SETUP.md](docs/STRIPE-SETUP.md) e [docs/PAYMENTS_AND_TRANSFERS.md](docs/PAYMENTS_AND_TRANSFERS.md).
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
| [docs/CONVERSATIONS.md](docs/CONVERSATIONS.md) | Ciclo do chat, prazos, reembolsos, modo anônimo, advertências e recursos. |
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
- O login limita tentativas por e-mail (8) e por IP (30) a cada 15 minutos, usando a cota `consume_auth_email_quota` (`src/lib/auth-email-throttle.ts`). Recuperação de senha, cadastro e verificação de CPF têm limites próprios na mesma tabela.
- Nunca execute pagamentos, reembolsos ou alterações financeiras no navegador.
