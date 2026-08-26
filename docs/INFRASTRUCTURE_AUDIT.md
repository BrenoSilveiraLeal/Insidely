# Auditoria de infraestrutura — Insidely

Data: 2026-08-26  
Escopo: repositório, Supabase, Vercel, Stripe, autenticação, Google Meet/Calendar, e-mail, segredos e testes locais.

## Resultado executivo

**Status final: BLOCKED_EXTERNAL**

O código local compila e os testes principais passam, mas a aplicação não deve ser considerada 100% pronta para lançamento profissional até que as integrações externas sejam validadas no ambiente de produção e o commit mais recente seja efetivamente publicado. Nenhum segredo é exibido neste relatório.

## Achados corrigidos

- **CRÍTICO — corrigido:** `PaymentAuditEvent` permitia privilégios de leitura e alteração para `anon` e `authenticated`. Foi criada a migration `restrict_payment_audit_access`, aplicada no projeto Supabase, removendo esses privilégios. O acesso ficou restrito ao `service_role`.
- **Documentação corrigida:** o retry de criação de reuniões não está agendado atualmente no Vercel Hobby; a documentação não afirma mais que ele roda a cada 15 minutos.

## Situação por serviço

| Área | Status | Evidência / pendência |
|---|---|---|
| Supabase Database | PASS | 28 tabelas públicas auditadas; RLS habilitado em 28/28; migrations remotas incluem a correção de `PaymentAuditEvent`. |
| Supabase RLS | PARTIAL | O advisor reporta tabelas com RLS sem policies. Isso pode ser intencional quando o acesso ocorre apenas por funções/service role, mas precisa de teste com dois usuários reais para confirmar isolamento entre contas. |
| Supabase Storage | PARTIAL | `verification-documents` é privado; `avatars` e `profile-covers` são públicos, comportamento compatível com mídia de perfil, mas deve ser confirmado como decisão de produto. |
| Supabase Auth | PARTIAL | Fluxos de login, recuperação/troca de senha, confirmação de e-mail e MFA existem no código. Configuração externa de provedores, URLs e políticas de e-mail não foi verificável integralmente por ferramenta. |
| Vercel | PARTIAL | Projeto e domínios Vercel identificados; deploy de produção mais recente está READY. O deploy é um redeploy de artefato antigo e não contém metadata do commit atual. Variáveis de produção não puderam ser auditadas sem expor valores. |
| Vercel Cron | PARTIAL | Apenas `release-bookings` está no `vercel.json`. `create-meetings` está protegido, mas sem agendamento automático no Hobby. |
| Stripe | PARTIAL | Conta LIVE, Checkout para cartão/boleto e webhook com assinatura/idempotência existem no código. Nenhum pagamento real foi executado, conforme a regra de segurança. |
| Resend/e-mail | BLOCKED_EXTERNAL | Código de envio existe, mas API key, domínio remetente, SPF, DKIM, DMARC e entrega real não foram verificados. |
| Google OAuth | BLOCKED_EXTERNAL | Callback seguro e integração Supabase existem, mas client ID, consent screen, redirect URI e domínio autorizado precisam ser validados no Google Cloud. |
| LinkedIn OIDC | BLOCKED_EXTERNAL | Fluxo suporta provedor, mas credenciais, redirect URI e escopos precisam ser confirmados no LinkedIn Developer Portal. |
| Google Meet/Calendar | BLOCKED_EXTERNAL | Código server-side usa refresh token e valida URL `meet.google.com`; não houve criação real de reunião nem validação dos escopos/credenciais de produção. |
| Domínio/DNS | BLOCKED_EXTERNAL | Foram confirmados domínios Vercel, mas não foi possível confirmar domínio customizado nem registros DNS de e-mail. |

## Segurança

- Não foram encontrados valores de chaves ativos em arquivos rastreados pelo Git nem no histórico analisado.
- `.env.local` contém segredos locais sensíveis e está ignorado pelo Git. Esses valores não foram expostos. Se já tiverem sido compartilhados fora da máquina, devem ser rotacionados.
- Headers de segurança, CSP, proteção contra redirect externo no callback e validação de assinatura Stripe estão implementados.
- O advisor do Supabase ainda sinaliza views/funções `SECURITY DEFINER`. Elas parecem fazer parte das projeções públicas e funções protegidas do produto, mas devem passar por revisão de exposição, `search_path`, autorização e limites antes do lançamento.
- A rota de documentos de verificação depende das policies RLS; falta um teste negativo comprovando que um usuário não consegue acessar documento de outro usuário.

## Verificações executadas

- TypeScript: **PASS** (`npx tsc --noEmit`)
- ESLint: **PASS** (`npm run lint`)
- Testes unitários: **PASS** — 13 testes
- Build de produção: **PASS** (`npm run build`)
- E2E público: **PASS** — 10 cenários desktop/mobile
- E2E autenticado: **BLOCKED_EXTERNAL** — ambiente Supabase de E2E não conectou
- `npm audit`: **BLOCKED_EXTERNAL** — endpoint do registry indisponível durante a execução
- Semgrep/Gitleaks/Trivy: **BLOCKED_EXTERNAL** — ferramentas não instaladas no ambiente
- Navegador integrado: **BLOCKED_EXTERNAL** — runtime Node do navegador não iniciou; Playwright CLI executou os cenários públicos
- Vercel runtime errors: houve um erro histórico isolado de permissão em `ProfessionalProfile` em deploy anterior; não houve erro de runtime nas últimas 24h consultadas.

## Pendências para READY_FOR_PRODUCTION

1. Publicar e validar o commit atual no Vercel; confirmar que o deploy de produção contém a migration e as correções de autenticação.
2. Auditar as variáveis Production/Preview no Vercel por nome, presença e ambiente, sem imprimir valores.
3. Testar Google, LinkedIn, confirmação de e-mail, reset de senha e MFA em navegador real.
4. Testar Stripe em modo de teste com cartão e boleto, replay de webhook e idempotência; depois revisar o caminho LIVE sem cobrar.
5. Validar Google Meet com duas reservas concorrentes e falha temporária da API.
6. Executar testes RLS negativos com dois usuários: perfil, reserva, mensagens, documentos, pagamentos e auditoria.
7. Configurar uma estratégia de retry para Meet compatível com Vercel Hobby, caso o produto exija criação automática após falha.
8. Verificar DNS e reputação de e-mail: SPF, DKIM, DMARC, domínio remetente e URLs oficiais.
9. Instalar/executar scanners SAST e secret scanning no CI e acompanhar os advisories do Supabase.

## Conclusão

Não há evidência de chave vazada no Git e o problema crítico de autorização da auditoria de pagamentos foi corrigido. O bloqueio restante é predominantemente de validação/configuração externa e publicação do código atual, não de uma falha reproduzida no fluxo público local.
