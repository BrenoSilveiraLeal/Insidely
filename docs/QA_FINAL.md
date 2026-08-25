# QA final

## Estado desta execução

- Modo cliente para consultor: implementado parcialmente nas rotas de cliente e navegação.
- Mensagens antes do pagamento: bloqueadas na interface e protegidas pela RPC.
- Jobs financeiros no render: removidos de consultas, agendamentos e ganhos.
- Transferências: tentativa persistida, retry possível e booking não é concluído antes do sucesso.
- Webhook: claim idempotente antes do processamento e estados de processamento.
- Disponibilidade: frontend padronizado em 30 e 60 minutos.
- RLS: índices e políticas de autenticação otimizadas em migration aplicada.

## Pendências

- Deploy da branch correta na Vercel.
- E2E autenticado com duas contas.
- Validação real de Stripe, Google Meet e Resend.
- Paginação da RPC do consultor.
- Experiências profissionais múltiplas com datas e privacidade de idade.
