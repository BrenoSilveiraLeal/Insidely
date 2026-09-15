# Production readiness - status atual

Data da verificacao: 2026-09-12

## Resultado

A aplicacao em producao responde corretamente. O codigo local passa nas validacoes estaticas, unitarias, build e E2E. O go-live completo ainda depende de validacoes de provedores externos que nao devem ser simuladas com dados reais.

## Evidencias verificadas

- Supabase: projeto `Insidely` ativo e saudavel; migrations aplicadas remotamente.
- Supabase: o runtime e os testes usam exclusivamente o projeto `Insidely`.
- Vercel: deployment READY com o commit `c185c70816a0b90841fc5f29ff6441e2e33cde34`.
- Producao: `/api/health` retornou HTTP 200 com `app=ok` e `database=ok`.
- Runtime Vercel: nenhum erro agrupado nos ultimos 7 dias e nenhum log de erro nas ultimas 24 horas.
- TypeScript: PASS (`npx tsc --noEmit`).
- ESLint: PASS (`npm run lint`).
- Testes unitarios: PASS (5 arquivos, 13 testes).
- Build: PASS (`npm run build`).
- E2E completo: PASS (12 cenarios desktop/mobile, incluindo fluxo autenticado).
- `npm audit`: PASS (0 vulnerabilidades apos `npm audit fix`).

## Alteracoes feitas

- Serializacao dos projetos Playwright para evitar colisao entre fixtures autenticadas compartilhadas.
- Retry controlado no login E2E e timeout maior apenas no fluxo autenticado, que compila o servidor na primeira execucao.
- Dependencias corrigidas com `npm audit fix`.
- Configuracao do Supabase Auth reforcada: senha minima de 8 caracteres, minusculas/maiusculas/numeros, troca segura de senha e exigencia da senha atual.

## Pendencias externas

1. Protecao contra senhas vazadas no Supabase Auth requer plano Pro; nao esta disponivel no Free.
2. Validar OAuth Google/LinkedIn, confirmacao de e-mail, reset de senha e MFA em navegador real.
3. Validar Resend, dominio remetente, SPF, DKIM e DMARC.
4. Executar matriz Stripe em test mode: checkout, boleto, webhooks duplicados, reembolso, disputa, Connect e idempotencia.
5. Validar criacao e retry de Google Meet com credenciais autorizadas.
6. Configurar alertas para pagamentos, repasses, Meet e e-mail.

As variaveis de producao necessarias foram encontradas no projeto Vercel. Os avisos de secret/config existentes nao foram rotacionados automaticamente para evitar interrupcao de integracoes ativas.

## Decisao operacional

O cron de liberacao de reservas esta configurado. A criacao/recriacao de Meet permanece protegida para operador ou scheduler externo, pois nao ha cron adicional configurado para o plano Vercel Hobby. O PIX manual continua legado e nao deve ser o fluxo oficial de producao.

## Auth verificado em 2026-09-12

- Confirmacao de e-mail: ativa.
- Troca segura de e-mail: ativa.
- Troca segura de senha: ativa.
- Exigencia da senha atual: ativa.
- URL do site: `https://insidely.vercel.app`.
- Redirect permitido: `https://insidely.vercel.app/auth/callback`.
- Google e LinkedIn OIDC: habilitados no painel.
