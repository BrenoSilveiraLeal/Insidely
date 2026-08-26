# Performance

Páginas autenticadas são dinâmicas e não devem executar jobs financeiros durante o render. Consultas, mensagens, notificações e pagamentos usam consultas paginadas conforme o volume cresce.

As métricas mínimas são TTFB, tempo das RPCs, tamanho do JSON, duração das queries Supabase e erros por rota.

O middleware registra o custo de atualização da sessão; as RPCs paginadas registram duração, bytes UTF-8 e erro em logs estruturados. O TTFB completo deve ser acompanhado por RUM/APM da Vercel.
