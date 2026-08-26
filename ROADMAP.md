# Roadmap

## Entregue nesta rodada

- modo cliente para consultor;
- bloqueio de mensagens antes do pagamento;
- remoção de jobs financeiros do render;
- tentativa de repasse idempotente;
- lifecycle de webhook;
- disponibilidade padronizada em 30/60 minutos;
- migrations de índices e RLS;
- documentação operacional e baseline de QA.
- E2E autenticado com duas contas isoladas;
- paginação do dashboard do consultor;
- múltiplas experiências profissionais com datas;
- privacidade de idade/faixa etária;
- testes mockados de Stripe, Meet, Resend e crons;
- revisão e correção das views públicas e funções críticas;
- deploy da aplicação e Edge Function em produção.

## Operação antes do lançamento

- validar Stripe em modo de teste com eventos reais;
- validar criação real de Meet e envio real de e-mails;
- alinhar o histórico local das migrations com o remoto;
- revisar os avisos restantes dos advisors do Supabase;
- concluir a auditoria de acessibilidade e configurar alertas de observabilidade.
