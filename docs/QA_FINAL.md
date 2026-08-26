# QA final — auditoria de segurança e produção

Data: 2026-08-26

## Status geral

`BLOCKED_EXTERNAL`

O código compila e os fluxos públicos passam, mas a aprovação profissional está bloqueada pela falta de conexão do ambiente E2E ao Supabase de teste e pela impossibilidade de validar credenciais externas reais sem enviar e-mails ou executar pagamentos. Nenhum pagamento real ou e-mail real foi enviado.

## Testes técnicos

| Item | Resultado | Evidência |
|---|---|---|
| TypeScript | PASS | `npx tsc --noEmit` |
| ESLint | PASS | `npm run lint`, com `.next-e2e` ignorado como artefato gerado |
| Testes unitários | PASS | 5 arquivos, 13 testes |
| Build | PASS | `npm run build` |
| `git diff --check` | PASS | sem erro de whitespace |
| E2E público | PASS | 10 testes desktop/mobile de home, busca, proteção e layout |
| E2E autenticado | BLOCKED_EXTERNAL | preflight não conectou ao Supabase de teste |
| Navegador in-app | BLOCKED_EXTERNAL | runtime do navegador não iniciou neste ambiente |
| CI | PARTIAL | workflow existe e usa Node 22/test secrets, mas não foi executado neste turno |
| Vercel | PARTIAL | deploy anterior READY; novo código ainda depende de publicação |
| Console do navegador | PARTIAL | verificações Playwright públicas passaram; fluxos autenticados bloqueados |

## Funcionalidades

| Funcionalidade | Resultado | Observação |
|---|---|---|
| Cadastro/login/logout | PARTIAL | código validado; conta real isolada não testada |
| Google | BLOCKED_EXTERNAL | depende de OAuth/configuração externa |
| LinkedIn | BLOCKED_EXTERNAL | depende de OAuth/configuração externa |
| Recuperação/troca de senha | PASS | código e build validados; e-mail real não enviado |
| Resend | BLOCKED_EXTERNAL | credencial/domínio e entrega real não validados |
| MFA | PARTIAL | TOTP/AAL2 implementado; teste interativo bloqueado |
| Perfis/busca | PASS | rotas públicas e layout passam E2E |
| Agenda/reservas | PARTIAL | fluxo autenticado bloqueado |
| Stripe/cartão/boleto | BLOCKED_EXTERNAL | integração presente; teste Stripe real proibido nesta auditoria |
| Webhooks | PASS | assinatura e idempotência cobertas por código/testes mockados |
| Avaliações/mensagens | PARTIAL | regras presentes; E2E autenticado bloqueado |
| Google Meet | BLOCKED_EXTERNAL | credenciais e criação real não validadas |
| Storage | PARTIAL | validação de arquivo e políticas presentes; teste autenticado bloqueado |
| Exclusão de conta | PARTIAL | Edge Function e chamada presentes; execução destrutiva não realizada |

## Segurança

- RLS: PARTIAL — habilitado e com políticas, mas advisors ainda reportam tabelas sem policy; revisar intencionalidade no remoto.
- Autorizações: PARTIAL — Server Actions/RPCs usam `requireUser`/`auth.uid()`; executar testes negativos com dois usuários.
- HTML/XSS: PASS na análise estática; não foram encontrados `dangerouslySetInnerHTML`, `eval` ou `new Function` no runtime.
- Tokens/senhas: PASS na análise de código e Git; nenhum segredo live rastreado ou exposto no relatório. `.env.local` contém segredos locais e permanece não rastreado.
- Dados pessoais/pagamentos: PARTIAL — isolamento depende de RLS remoto e testes cross-tenant ainda bloqueados.
- Storage: PARTIAL — documentos usam signed URL curta e validação; autorização explícita da rota deve ser coberta por teste negativo.
- Dependências: BLOCKED_EXTERNAL — `npm audit` não alcançou o endpoint do registry.
- IDOR/BOLA: PARTIAL — checks existem, mas não houve execução com duas identidades reais de teste.
- Open redirect: PASS — callback rejeita destinos externos em teste E2E.
- Manipulação de preço: PASS na revisão — preço é calculado no servidor/RPC e Checkout usa dados do booking.
- Logs: PARTIAL — não há logging intencional de segredos; revisão de logs de produção ainda pendente.

## Correções realizadas

- Revogado remotamente o acesso de `anon` e `authenticated` à tabela financeira `PaymentAuditEvent`.
- Criada a migration `supabase/migrations/20260826120000_restrict_payment_audit_access.sql`.
- Corrigido o ESLint para ignorar `.next-e2e/**` sem ignorar o código-fonte.
- Mantidos os fluxos de confirmação de e-mail, recuperação/troca de senha e MFA.
- Não foram removidas migrations ou rotas protegidas sem confirmação de uso.

## Pendências

1. **Crítica — resolvida:** grants de `PaymentAuditEvent`; aplicada e verificada no Supabase remoto.
2. **Alta — bloqueada externamente:** executar E2E com projeto Supabase de teste dedicado e duas contas isoladas.
3. **Alta — bloqueada externamente:** validar Google OAuth/Meet e Resend com credenciais de teste autorizadas.
4. **Alta — bloqueada externamente:** validar Stripe em modo test, incluindo boleto assíncrono, webhook e idempotência.
5. **Média:** revisar avisos restantes dos advisors, especialmente views `SECURITY DEFINER` e tabelas RLS sem policy.
6. **Média:** repetir `npm audit` em CI/rede com acesso ao registry.
7. **Média:** publicar o commit final na Vercel e revisar logs de runtime após o deploy.
8. **Baixa:** remover ou documentar completamente o PIX legado quando o fluxo não for mais necessário.

## Proteção de credenciais

Nenhuma senha, service role key, segredo OAuth, refresh token, webhook secret, chave Stripe ou dado pessoal foi incluído neste relatório, commit ou saída de teste. Se qualquer segredo local tiver sido compartilhado fora do computador confiável, ele deve ser rotacionado no provedor.
