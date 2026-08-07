# Relatório de validação

Data: 7 de agosto de 2026.

## Executado neste ambiente

| Verificação | Resultado |
|---|---|
| `prisma validate` | aprovado |
| `prisma generate` | aprovado |
| migração SQL gerada do schema | aprovado, 503 linhas |
| `npx tsc --noEmit` | aprovado, zero erros |
| `npm run lint` | aprovado, zero avisos do projeto |
| `npm run test` | 3 testes aprovados |
| catálogo determinístico | 80 e-mails únicos; 20 empresas; 25 profissões; três modos de privacidade |
| revisão de boas práticas React | aprovada com autenticação em actions, consultas paralelas e fronteira cliente restrita à animação/formulários |

## Limitações do ambiente de geração

Não havia um processo PostgreSQL nem Docker disponível, portanto o seed e as jornadas Playwright que dependem de banco não foram executados aqui. A suíte E2E foi entregue e deve ser executada depois de `db:deploy` + `db:seed`.

O `next build` foi iniciado, mas o runtime isolado retornou `ENOENT: uv_resident_set_memory` antes da compilação — falha do runtime Node/sandbox, não um diagnóstico de código. Como verificações substitutas, TypeScript, ESLint, geração Prisma e testes unitários passaram. Execute o build novamente em Node 20/22 convencional, GitHub Actions ou Vercel.

## Jornadas cobertas pelo E2E entregue

- home → busca e exibição do contador derivado do seed;
- login do usuário → painel e consulta futura persistida;
- login do administrador → fila de verificações e ação de moderação;
- projetos desktop Chromium e Pixel 7.

