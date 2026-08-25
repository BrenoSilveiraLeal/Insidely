# QA baseline

Data da baseline: 2026-08-25

## Código

- Branch local: `main`
- Commit local: `5f978599de49d4933cc33d8f498e832584b070aa`
- Última mensagem: `fix consultant booking notifications visibility`
- Worktree inicial: limpo
- Remote configurado: `origin` aponta para o repositório GitHub do Insidely
- Validação de atualização do remote: bloqueada neste ambiente por falta de acesso de rede ao GitHub

## Aplicação

- Next.js 16.3.2
- React 19.2.8
- Node declarado: 24.x
- Supabase JS 2.112.3
- Stripe 22.5.0
- Vitest 4.1.11
- Playwright 1.62.1

## Validação inicial

- `npm run lint`: aprovado
- `npm test`: aprovado, 2 arquivos e 9 testes
- `npm run build`: aprovado
- E2E público desktop: aprovado, 5 testes

## Banco e deploy observados

- Projeto Supabase: `cghorzqnbhjcbwsuyrjp`
- Migrations de correção de agendamento e notificações verificadas como aplicadas no Supabase
- Último deployment de produção observado na Vercel: commit `e834cf2b36c4d31fa0db5ad9d3effb2aa5db4a12`
- Produção estava atrasada em relação ao commit local
- Runtime error observado na Vercel: permissão negada para `ProfessionalProfile` em `/agendar/[id]`

## Bloqueios externos

- Não há credenciais locais para executar pagamentos reais, Google Meet, Resend ou fluxos autenticados reais.
- Não foi feito deploy ou push nesta baseline.
- Fluxos que dependem de duas contas reais precisam de credenciais ou fixtures isoladas.
