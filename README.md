# Insidely

Marketplace de conversas profissionais para conhecer a realidade de empresas e profissões antes de tomar decisões de carreira. O frontend é Next.js 16 e o backend usa exclusivamente Supabase (Auth, Postgres, Storage e Edge Functions).

## Requisitos

- Node.js 22 LTS (consulte `.nvmrc`)
- npm 10 ou mais recente
- Um projeto Supabase
- Navegadores Playwright para os testes E2E

## Instalação

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Variáveis:

- `NEXT_PUBLIC_APP_URL`: origem pública da aplicação, sem barra final.
- `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave publicável; é segura no navegador quando RLS está correto.
- `PIX_RECEIVER_KEY`: chave da plataforma exibida no checkout. Não há fallback.
- `OPENAI_API_KEY`: opcional, somente para moderação avançada de avatar. A validação local continua funcionando sem ela.
- `GOOGLE_MEET_ENABLED`: ativa a integração Google Meet somente quando toda a configuração OAuth estiver pronta.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: credenciais server-side para uma futura integração Meet; nunca recebem prefixo `NEXT_PUBLIC_`.

Nunca exponha uma chave secret/service-role em `NEXT_PUBLIC_*`.

## Supabase

`supabase/baseline/schema.sql` é o snapshot reproduzível do esquema legado. Em um projeto vazio, aplique-o uma vez e depois execute, em ordem, as migrations incrementais de `supabase/migrations`. Em projetos já existentes, aplique apenas as migrations ainda não registradas:

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Elas criam/atualizam RPCs com validação de `auth.uid()`, índices, RLS e os buckets:

- `avatars`: público para leitura; escrita e remoção limitadas ao diretório do titular; 3 MB; JPEG/PNG/WEBP.
- `verification-documents`: privado; titular e administradores autorizados; 5 MB; PDF/JPEG/PNG/WEBP.

A Edge Function de exclusão está em `supabase/functions/delete-account`:

```bash
npx supabase functions deploy delete-account
```

Ela exige JWT, confirmação do e-mail, remove arquivos, anonimiza o registro necessário para integridade histórica, registra auditoria mínima e exclui o usuário do Supabase Auth.

## Autenticação

Google e LinkedIn usam Supabase Auth. Configure os client IDs/secrets no painel Supabase e cadastre `<APP_URL>/auth/callback` nos provedores. O callback aceita apenas caminhos locais e sincroniza ambos os provedores pela RPC genérica `sync_social_profile`.

O 2FA usa Supabase MFA TOTP: cadastro de fator, QR Code, confirmação, listagem, remoção, desafio após login e verificação AAL2. Se Challenge/Verify estiver desativado no painel Auth, habilite-o para TOTP.

## Pagamento

O PIX atual é demonstrativo. A aplicação gera o payload e permite informar o pagamento; a equipe confirma manualmente. Isso não constitui custódia, escrow ou retenção financeira automática. Um gateway regulado será necessário para movimentação e repasse reais.

## Comandos

```bash
npm run db:health
npx tsc --noEmit
npm run lint
npm test
npm run build
npx playwright install
npm run test:e2e
```

`db:health` consulta de verdade a Data API configurada e retorna código diferente de zero em caso de falha.

## Deploy

O repositório está conectado à Vercel. Configure as mesmas variáveis nos ambientes Preview/Production, aplique migrations e publique a Edge Function antes de promover o deploy.

## Segurança e operação

- RLS permanece habilitado; autorização não usa `user_metadata`.
- As seis views públicas são projeções deliberadamente limitadas e usam `security_definer` porque as tabelas-base não são expostas a `anon`; qualquer nova coluna precisa de revisão de privacidade. Views internas usam `security_invoker`.
- O endpoint `/api/health` chama uma RPC sem acesso a dados e nunca revela nomes de tabelas ou mensagens internas.
- Documentos de verificação nunca usam URL pública.
- RPCs privilegiadas revogam execução de `PUBLIC` e derivam identidade de `auth.uid()`.
- Revise periodicamente os advisors de segurança/desempenho do Supabase.

## Solução de problemas

- `Invalid Version` no npm: use Node 22 e o lockfile versionado; não reutilize `node_modules` antigo.
- Login social volta com erro: confira URL de callback e credenciais no painel Supabase/provedor.
- 2FA não desafia: confira se há fator `verified` e se TOTP Challenge/Verify está habilitado.
- Checkout indisponível: configure `PIX_RECEIVER_KEY`.
- Upload negado: confirme migration dos buckets, MIME, tamanho e que o caminho começa pelo UUID autenticado.
