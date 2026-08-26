# E2E autenticado: execução determinística

O fluxo autenticado usa exclusivamente um servidor Next iniciado pelo Playwright em `127.0.0.1:3111` (ou na porta definida por `PLAYWRIGHT_PORT`). Ele não usa `PLAYWRIGHT_BASE_URL`, `localhost:3000` ou um servidor antigo já aberto.

## Configuração local

No PowerShell, dentro de `C:\Insidely`, informe a URL e a service role key do projeto Supabase CI. A URL deve ficar em `E2E_SUPABASE_URL`; o teste não usa `NEXT_PUBLIC_SUPABASE_URL` como fallback, evitando apontar acidentalmente para produção. A service role key é secreta e não deve ser commitada:

```powershell
$env:E2E_SUPABASE_URL = "https://SEU_REF.supabase.co"
$env:E2E_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_..."
$env:E2E_SUPABASE_SERVICE_ROLE_KEY = "sb_secret_..."
npm run e2e:preflight
```

O preflight rejeita URL inválida, publishable key no campo privilegiado e porta ocupada. Ele nunca imprime o valor da chave.

## Execução

```powershell
npm run test:e2e:auth
```

São executados dois projetos: desktop Chromium e mobile Chromium, com duas contas criadas pelo fixture e removidas no `afterAll`. Para diagnóstico visual:

```powershell
npm run test:e2e:debug
```

O fluxo público pode ser validado sem a service role key:

```powershell
npx playwright test e2e/core-flows.spec.ts --workers=1
```

Se `3111` estiver ocupada por outro processo, não reutilize o processo antigo. Use uma porta livre, por exemplo:

```powershell
$env:PLAYWRIGHT_PORT = "3112"
npm run test:e2e:auth
```
