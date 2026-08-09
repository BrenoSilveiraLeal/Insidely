# INSIDELY

MVP acadêmico completo para decisões de carreira baseadas em conversas contextualizadas com profissionais. O projeto é um repositório Next.js convencional e independente, pronto para VS Code, GitHub e Vercel — sem dependência de `*.chatgpt.site`.

## Stack

- Next.js 16 (App Router), React 19 e TypeScript estrito
- PostgreSQL + Prisma ORM, migração SQL versionada e seed determinístico
- Auth.js Credentials com sessão JWT, bcrypt e RBAC (`USER`, `CONSULTANT`, `ADMIN`)
- Motion e GSAP/ScrollTrigger para movimento editorial progressivo
- Tailwind CSS 4 como pipeline CSS; Design System próprio em `globals.css`
- Vitest e Playwright

## Funcionalidades implementadas

- Catálogos persistidos de 20 empresas, 25 profissões e 80 profissionais demonstrativos
- Busca real por palavra-chave, empresa, profissão e modo de trabalho
- Perfis com privacidade pública, protegida ou pseudônima
- Cadastro, login, logout, onboarding e autorização por papel
- Favoritos, horários, agendamento atômico e checkout demonstrativo persistente
- Consultas, pagamentos simulados, conversas, mensagens, avaliações e notificações
- Painel do usuário, painel do consultor e painel administrativo
- Privacidade granular, solicitação/aprovação de verificação e fila de denúncias
- Reality Checks por profissão
- Contadores calculados a partir do banco de dados

## Executar localmente

Requisitos: Node.js 20.9+ e Docker, ou uma instância PostgreSQL acessível.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

### Acessos demonstrativos

Todos usam a senha `Demo@123`:

| Papel | E-mail |
|---|---|
| Usuário | `demo@insidely.com` |
| Consultor | `consultor@insidely.com` |
| Admin | `admin@insidely.com` |

Os dados são fictícios e identificados como demonstrativos. O checkout altera estados reais no banco, mas não processa cartão nem dinheiro.

## Banco de dados

- Modelo: `prisma/schema.prisma`
- Migração inicial: `prisma/migrations/0001_init/migration.sql`
- Seed: `prisma/seed.ts`
- Gerador determinístico: `prisma/seed-data.ts`

Para resetar um banco de desenvolvimento:

```bash
npm run db:migrate -- --name reset
npm run db:seed
```

O seed limpa somente as tabelas da aplicação na base apontada por `DATABASE_URL`. Nunca execute contra uma base com dados que deseja preservar.

## Qualidade

```bash
npm run lint
npm run test
npx tsc --noEmit
npm run build
npm run test:e2e
```

O E2E pressupõe banco migrado/seedado e servidor em `http://127.0.0.1:3000`. Defina `PLAYWRIGHT_BASE_URL` para usar outra URL.

## Deploy na Vercel

1. Envie este diretório para um repositório GitHub.
2. Importe o repositório na Vercel.
3. Crie/conecte um PostgreSQL gerenciado (Neon, Supabase, AWS RDS etc.).
4. Configure `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` e `NEXT_PUBLIC_APP_URL`.
5. Execute `npm run db:deploy` e `npm run db:seed` uma única vez contra a base de destino.
6. Faça o deploy. O `postinstall` gera automaticamente o Prisma Client.

Gere `AUTH_SECRET` com `openssl rand -base64 32`. Em produção, use `AUTH_URL` e `NEXT_PUBLIC_APP_URL` com a URL HTTPS final.

## Estrutura principal

```text
src/app/              rotas públicas, autenticação, fluxos e painéis
src/components/       navegação, cartões, formulários e movimento editorial
src/lib/              Prisma, consultas, sessão e formatação
prisma/               schema, migração e seed
e2e/                  testes de jornada no navegador
docs/                 auditoria, Design System e relatório de validação
```

## Transparência

Este é um MVP acadêmico. Empresas citadas não patrocinam nem mantêm vínculo com a Insidely. Experiências e avaliações do seed são fictícias. O produto não promete contratação, não divulga documentos de verificação e proíbe informações confidenciais ou dados pessoais de terceiros.

