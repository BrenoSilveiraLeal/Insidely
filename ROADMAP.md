# Estado do produto e próximos passos

Este roadmap separa funcionalidades que já aparecem no código de tarefas operacionais que ainda exigem configuração ou validação externa. Os detalhes de cada fluxo ficam nos documentos vinculados.

## Entregue

- Marketplace com perfis profissionais, busca, favoritos, disponibilidade e avaliações.
- Painéis de cliente, consultor e administração, com paginação, notificações e privacidade de perfil.
- Reservas por vídeo e pedidos de perguntas por mensagem, com estados e encerramentos próprios.
- Chat em tempo real com moderação, recibos de leitura, contestações, denúncias e histórico preservado.
- Identificação de contas, controles de confiança e segurança, suporte e ferramentas administrativas.
- Checkout demonstrativo, registro de pagamentos e código server-side preparado para integrações financeiras.
- Integrações opcionais de OAuth, e-mail, Google Meet, web push e observabilidade.
- Suíte unitária e fluxos E2E documentados em `docs/E2E_TESTS.md`.

## Próximos passos operacionais

1. Manter o checkout em modo demonstrativo até a validação completa do fluxo Stripe em ambiente de teste e a ativação explícita da integração.
2. Validar as credenciais e os fluxos reais de OAuth, e-mail e Google Meet nos ambientes de publicação.
3. Conferir o histórico remoto do Supabase antes de cada migration; o README descreve a aplicação isolada usada neste projeto.
4. Revalidar build, QA, acessibilidade, segurança e alertas antes de alterações que afetem o lançamento.

## Referências

- Regras de vídeo e mensagens: [docs/CONVERSATIONS.md](docs/CONVERSATIONS.md).
- Camadas e fronteiras de autorização: [ARCHITECTURE.md](ARCHITECTURE.md).
- Pagamentos: [docs/PAYMENTS_AND_TRANSFERS.md](docs/PAYMENTS_AND_TRANSFERS.md).
- Publicação: [docs/DEPLOY.md](docs/DEPLOY.md).
- Relatórios de qualidade: `docs/QA_*.md` e `docs/PRODUCTION_READINESS_CURRENT.md`; cada relatório é um retrato datado, não uma garantia contínua.
