# Auditoria de operação e QA

Data: 26/08/2026

## Observabilidade

- `proxy.ts` registra duração da sessão Supabase por rota e adiciona `Server-Timing: supabase_session`.
- `src/lib/observability.ts` registra RPC, rota, duração, tamanho UTF-8 do JSON de resposta e erro sem registrar payload ou dados pessoais.
- Consultar esses eventos nos logs da Vercel/Drain e criar alertas para erro de rota/RPC, p95 de TTFB e crescimento do JSON.
- O tempo medido pelo proxy é o custo do middleware; TTFB completo deve ser medido no navegador/RUM ou no APM da Vercel.

## Advisors Supabase

Executar com conexão autenticada ao projeto:

```bash
npx supabase db advisors --type security
npx supabase db advisors --type performance
npm run db:health
```

Registrar o resultado junto ao deploy. A execução local foi tentada anteriormente, mas o CLI não conseguiu gravar sua telemetria fora do workspace; não há resultado remoto neste ambiente.

## Matriz de estados

Verificar em desktop e mobile cada rota autenticada e pública:

| Fluxo | Vazio | Loading | Erro | Retry |
|---|---|---|---|---|
| busca/perfil | sem resultados | skeleton | falha de Data API | nova busca/reload |
| agendamento/checkout | sem horários | ação pendente | sessão/pagamento | voltar e tentar novamente |
| mensagens | sem conversas/bloqueada | envio pendente | rate limit/RPC | reenviar após feedback |
| consultas/ganhos | sem registros/página vazia | loading route | RPC indisponível | trocar página/reload |
| notificações | nenhuma | loading route | falha de leitura | reload |
| Meet/e-mail | integração indisponível | cron em andamento | log de integração | cron seguinte |

## Segurança e rate limit

- `send_message` limita 10 mensagens por minuto por remetente no banco e bloqueia links/contatos.
- Cron exige `Authorization: Bearer CRON_SECRET`.
- Webhook exige assinatura Stripe válida e possui claim idempotente de evento.
- Operações privilegiadas passam por `requireUser`/`auth.uid()` e RPCs com grants restritos.
- Ainda é necessário executar testes de carga/concorrência no Supabase para confirmar o comportamento sob múltiplas requisições simultâneas.

## Acessibilidade

- Conferir foco visível, ordem de teclado, labels, mensagens `role=status/alert`, contraste, zoom 200%, viewport 390px e desktop 1440px.
- Testar com VoiceOver/NVDA quando possível; Playwright cobre navegação e estados funcionais, não substitui leitor de tela.
- O loading global usa `aria-busy`; revisar cada formulário novo para feedback de erro e estado pendente.

## Fixtures CI

Os fixtures autenticados estão em `e2e/authenticated-flow.fixture.ts` e criam duas contas isoladas usando `E2E_SUPABASE_SERVICE_ROLE_KEY`. O CI deve usar um projeto Supabase de teste dedicado, nunca credenciais de produção. Sem essa secret o teste é pulado, não considerado aprovado.
