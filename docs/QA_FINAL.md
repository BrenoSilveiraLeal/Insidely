# QA final — auditoria de segurança e produção

## Checagem minuciosa — 2026-10-16: segurança, validações e privacidade (35/35)

Foco em quebrar o sistema, em produção, com dois clientes e um consultor:

- **Segurança.** Um cliente não abre checkout, sala, calendário ou consulta de outro. Pela API, com a sessão dele, não lê nem altera reservas, pagamentos, mensagens, notificações ou e-mails de terceiros, não confirma, contesta, avalia ou envia mensagem em conversa alheia, não mexe na agenda do consultor e não vira admin. A API anônima não lê nenhuma tabela privada. Documentos de verificação não são públicos. Admin e painel do consultor exigem o papel certo. Crons exigem segredo.
- **Concorrência e validações.** Dois clientes no mesmo horário: só um reserva. Clique triplo em pagar gera um pagamento e uma notificação. Recusam: objetivo curto, nome fictício com telefone, preço abaixo de R$ 10, falso PDF, foto acima de 3 MB, mensagem vazia, com mais de 2.000 caracteres ou com e-mail. Cadastro recusa e-mail repetido, senha fraca e senhas diferentes.
- **Fluxos.** Foto e capa são enviadas e removidas. Senha é redefinida pelo link do e-mail. O botão Google leva ao login do Google. Endereços inexistentes mostram "não encontrada". O `sitemap.xml` e o `robots.txt` estão válidos.
- **Privacidade.** Com tudo oculto: sem nome real, sobrenome, empresa e cidade, e fora da busca por empresa. Com tudo visível: tudo aparece.
- **Qualidade.** Sem imagens quebradas nem erros de console. Uma `h1` por página. Carga rápida.
- **Dados de demonstração.** 80 de 82 perfis têm horários livres até janeiro de 2027.

Corrigido: o React 19 limpava os campos depois de um erro de validação, obrigando a redigitar tudo (cadastro, login, onboarding e perfil); o erro do perfil aparecia com estilo de sucesso; 11 páginas públicas tinham o mesmo título.

## Checagem ampliada — 2026-10-16: 33/33 + regressão 67/67

Segunda bateria, em produção, cobrindo o que a primeira não tocava: os 90 links internos de todas as páginas públicas (menus suspensos, rodapé e menu do celular); favoritar e desfavoritar (pelo perfil e pela página de favoritos); compartilhar perfil; denúncia resolvida pelo admin; aprovação de comprovante pelo admin (selo no perfil e notificação ao consultor); reserva sem pagamento expirando após 30 minutos e quando o horário passa (status "Expirada" para os dois lados, notificações, checkout bloqueado e horário liberado); nova reserva de um horário liberado; cancelamento de pedido não pago; notificações (abrir, marcar como lida, marcar todas); consentimento de gravação; download do `.ics`; contestação; conclusão automática 24 h depois de uma conversa paga sem confirmação (com avaliação e ganhos liberados); "Modo cliente"; sair da conta. Todas as 31 funções do banco chamadas pelo código existem.

Bugs encontrados e corrigidos: um horário liberado por reserva expirada ou cancelada aparecia como disponível mas não podia ser reservado (índice único em `Booking.availabilityId`, agora parcial sobre reservas ativas); os botões "Aprovar"/"Rejeitar" do admin sempre falhavam (a função `admin_review_verification` nunca tinha sido criada no banco remoto); o consentimento de gravação aparecia em reservas expiradas; o menu do admin tinha dois itens "Suporte".

## Análise final — 2026-10-16: 67/67 verificações aprovadas

Roteiro automatizado no navegador, em produção, com contas temporárias apagadas ao final: 12 páginas públicas, busca e filtros, detalhes de empresa/profissão/Reality Check, 404, login inválido, cadastro com e-mail de confirmação, recuperação de senha; consultor (onboarding, 12 links do menu, edição de perfil, foto, comprovante, privacidade, conversa imediata, adicionar/remover horários, perfil público); cliente (8 links do menu, busca, favoritos, denúncia, agendamento imediato e futuro, checkout com Pix/crédito/débito/boleto, confirmação do pagamento, link do Google Meet, `/sala` dentro e fora do horário, convite `.ics`, notificações, chat nos dois sentidos com bloqueio de contato, cancelamento pelo consultor, confirmação dupla, avaliação, ganhos, troca de nome e senha, 2FA, suporte); celular sem rolagem lateral; exclusão das duas contas pela tela, com o perfil saindo da busca. Nenhum erro nos logs da Vercel.

Bugs encontrados e corrigidos nesta análise: salvar a privacidade sempre falhava (`update_privacy` atribuía `showFullHistory` duas vezes); a troca de senha sempre falhava (o Supabase exige a senha atual, que o formulário não pedia); mensagem com telefone/link derrubava a página do chat; o perfil de um consultor excluído continuava na busca; a cidade nunca aparecia no perfil público; mensagens de erro ilegíveis nos painéis claros.

## Atualização — 2026-10-16 (teste de ponta a ponta em produção)

Testado no navegador (Playwright/Chromium) em https://insidely.vercel.app, com contas temporárias de consultor e cliente removidas ao final, em desktop e celular (390 px).

| Fluxo | Resultado |
|---|---|
| Cadastro pela tela e link de confirmação por e-mail | PASS: link reutilizado é recusado |
| Primeiro login e onboarding (papel e valor da conversa) | PASS |
| Menus do consultor (13 itens) e do cliente (9 itens) | PASS: nenhuma página quebrada; menu recolhível no celular |
| Conversa imediata e horário agendado | PASS |
| Checkout simulado (Pix, crédito, débito, boleto) | PASS |
| Link do Google Meet no chat dos dois participantes | PASS: `meet.google.com/...` |
| E-mails de pagamento e confirmação (Gmail SMTP) | PASS: sem erros nos logs |
| Mensagens entre cliente e consultor | PASS |
| Confirmação dupla, avaliação e ganhos | PASS |
| TypeScript, ESLint, 23 testes, build (Next.js 16.3.8) | PASS |

Correções desta rodada: perfil criado no primeiro login (antes só pelo link de e-mail, e o Next memoizava a busca repetida); datas do banco lidas como UTC (antes deslocavam 3 h conforme o fuso); preço definido no onboarding (antes R$ 0,00); link da sala como mensagem fixada no chat; e-mail sem código Pix real; cadastro e recuperação de senha enviados pelo SMTP da aplicação; token do Google Meet renovado com o app OAuth em produção; Next.js atualizado de 16.3.5 para 16.3.8 (corrige uma RCE crítica e outras falhas). Restou no `npm audit` apenas o `braces`, da ferramenta de lint, sem correção publicada.

## Atualização — 2026-10-15

Pagamentos agora são **simulados** (Pix, crédito, débito e boleto, sem Stripe); os itens de Stripe abaixo descrevem a integração original, que permanece no código mas fora do checkout.

| Item | Resultado | Observação |
|---|---|---|
| TypeScript, ESLint, testes unitários (21), build | PASS | sem avisos de lint |
| Rotas públicas e redirecionamento de rotas protegidas em produção | PASS | |
| Busca, perfil público e agendamento | CORRIGIDO | `public_profile_cards` havia sido recriada com `security_invoker`, gerando `permission denied for table PrivacySettings` para visitantes; restaurada em `20261016000100` |
| Conversa imediata | CORRIGIDO | a reserva expirava logo após ser criada porque o horário já tinha começado; expiração agora considera o fim do horário |
| Pagamento após o prazo de 30 minutos | CORRIGIDO | checkout expira reservas vencidas antes de exibir/aceitar o pagamento |
| Ganhos do consultor | CORRIGIDO | lista passou a incluir pagamentos simulados (`PAID_HELD`) |
| Conclusão e avaliação | CORRIGIDO | confirmação liberada após o início da conversa; conclusão automática em 24 h também para pagamentos simulados; auto-agendamento de teste não trava; autoavaliação bloqueada |
| Redirecionamento de notificações | CORRIGIDO | usa `safeInternalPath` |
| E2E autenticado | PENDENTE | requer projeto Supabase de teste e contas E2E dedicadas (`docs/E2E_TESTS.md`) |

## Auditoria anterior

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
