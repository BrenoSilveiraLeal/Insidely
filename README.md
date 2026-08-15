# Insidely

Aplicação Next.js hospedada na Vercel com backend exclusivamente Supabase: Auth, Postgres, Storage, RLS e RPCs.

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_APP_URL`. O login Google usa Supabase Auth e o callback sincroniza o perfil pelo `auth.users.id`.

Comandos: `npm run dev`, `npm test`, `npx tsc --noEmit` e `npm run build`.
