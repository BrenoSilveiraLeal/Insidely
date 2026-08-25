# Performance

Páginas autenticadas são dinâmicas e não devem colocar jobs financeiros no render. Consultas, mensagens, notificações e pagamentos devem ser paginados conforme o volume crescer.

As métricas mínimas a acompanhar são TTFB, tempo de RPC, tamanho do JSON, duração de queries Supabase e erros por rota.

O dashboard do consultor ainda usa uma RPC agregada grande; a próxima etapa é separar resumo, bookings, mensagens e notificações em consultas paginadas.
