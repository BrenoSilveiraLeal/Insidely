# Deploy

## Ordem segura

1. Confirmar `git status` e o commit correto em `main`.
2. Executar `npm ci`, `npm run lint`, `npm test` e `npm run build`.
3. Aplicar migrations no Supabase e confirmar em `supabase_migrations.schema_migrations`.
4. Configurar variáveis em Preview e Production.
5. Publicar na Vercel.
6. Confirmar o commit do deployment e testar `/api/health`.
7. Observar logs de runtime antes de considerar concluído.

Nunca declarar produção publicada sem conferir o SHA do deployment.
