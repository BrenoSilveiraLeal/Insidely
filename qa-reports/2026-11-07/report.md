# QA responsivo — Insidely — 2026-11-07

## Ambiente

- Aplicação: `http://127.0.0.1:3111`, iniciada com `npm run dev -- -p 3111`.
- Navegador: Chromium headless via Playwright, com movimento reduzido para estabilizar as capturas.
- Ferramentas: Playwright 1.62.1, E2E do projeto, axe-core via E2E, ESLint e Vitest.
- Resultado representa o código local desta execução. Não foi feita validação em produção nem em hardware físico.

## Inventário e cobertura responsiva

Cobertos 13 caminhos públicos estáticos e quatro exemplos de modelos dinâmicos: perfil, empresa, profissão e Reality Check. Cada combinação da matriz foi aberta diretamente no navegador, aguardou rede ociosa e carregou imagens lazy antes da captura.

As sete dimensões exigidas foram usadas em cada rota. Todas as 119 combinações retornaram HTTP 200, sem overflow horizontal, erro de console, imagem carregada quebrada ou resposta HTTP com falha. Os screenshots finais estão vinculados por rota e viewport:
| Rota | 375×812 | 430×932 | 768×1024 | 1366×768 | 1536×864 | 1920×1080 | 3840×2160 |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | [PASS](screenshots/home__375x812.png) | [PASS](screenshots/home__430x932.png) | [PASS](screenshots/home__768x1024.png) | [PASS](screenshots/home__1366x768.png) | [PASS](screenshots/home__1536x864.png) | [PASS](screenshots/home__1920x1080.png) | [PASS](screenshots/home__3840x2160.png) |
| `/buscar` | [PASS](screenshots/buscar__375x812.png) | [PASS](screenshots/buscar__430x932.png) | [PASS](screenshots/buscar__768x1024.png) | [PASS](screenshots/buscar__1366x768.png) | [PASS](screenshots/buscar__1536x864.png) | [PASS](screenshots/buscar__1920x1080.png) | [PASS](screenshots/buscar__3840x2160.png) |
| `/empresas` | [PASS](screenshots/empresas__375x812.png) | [PASS](screenshots/empresas__430x932.png) | [PASS](screenshots/empresas__768x1024.png) | [PASS](screenshots/empresas__1366x768.png) | [PASS](screenshots/empresas__1536x864.png) | [PASS](screenshots/empresas__1920x1080.png) | [PASS](screenshots/empresas__3840x2160.png) |
| `/profissoes` | [PASS](screenshots/profissoes__375x812.png) | [PASS](screenshots/profissoes__430x932.png) | [PASS](screenshots/profissoes__768x1024.png) | [PASS](screenshots/profissoes__1366x768.png) | [PASS](screenshots/profissoes__1536x864.png) | [PASS](screenshots/profissoes__1920x1080.png) | [PASS](screenshots/profissoes__3840x2160.png) |
| `/reality-check` | [PASS](screenshots/reality-check__375x812.png) | [PASS](screenshots/reality-check__430x932.png) | [PASS](screenshots/reality-check__768x1024.png) | [PASS](screenshots/reality-check__1366x768.png) | [PASS](screenshots/reality-check__1536x864.png) | [PASS](screenshots/reality-check__1920x1080.png) | [PASS](screenshots/reality-check__3840x2160.png) |
| `/seguranca` | [PASS](screenshots/seguranca__375x812.png) | [PASS](screenshots/seguranca__430x932.png) | [PASS](screenshots/seguranca__768x1024.png) | [PASS](screenshots/seguranca__1366x768.png) | [PASS](screenshots/seguranca__1536x864.png) | [PASS](screenshots/seguranca__1920x1080.png) | [PASS](screenshots/seguranca__3840x2160.png) |
| `/ajuda` | [PASS](screenshots/ajuda__375x812.png) | [PASS](screenshots/ajuda__430x932.png) | [PASS](screenshots/ajuda__768x1024.png) | [PASS](screenshots/ajuda__1366x768.png) | [PASS](screenshots/ajuda__1536x864.png) | [PASS](screenshots/ajuda__1920x1080.png) | [PASS](screenshots/ajuda__3840x2160.png) |
| `/termos` | [PASS](screenshots/termos__375x812.png) | [PASS](screenshots/termos__430x932.png) | [PASS](screenshots/termos__768x1024.png) | [PASS](screenshots/termos__1366x768.png) | [PASS](screenshots/termos__1536x864.png) | [PASS](screenshots/termos__1920x1080.png) | [PASS](screenshots/termos__3840x2160.png) |
| `/privacidade` | [PASS](screenshots/privacidade__375x812.png) | [PASS](screenshots/privacidade__430x932.png) | [PASS](screenshots/privacidade__768x1024.png) | [PASS](screenshots/privacidade__1366x768.png) | [PASS](screenshots/privacidade__1536x864.png) | [PASS](screenshots/privacidade__1920x1080.png) | [PASS](screenshots/privacidade__3840x2160.png) |
| `/sobre` | [PASS](screenshots/sobre__375x812.png) | [PASS](screenshots/sobre__430x932.png) | [PASS](screenshots/sobre__768x1024.png) | [PASS](screenshots/sobre__1366x768.png) | [PASS](screenshots/sobre__1536x864.png) | [PASS](screenshots/sobre__1920x1080.png) | [PASS](screenshots/sobre__3840x2160.png) |
| `/entrar` | [PASS](screenshots/entrar__375x812.png) | [PASS](screenshots/entrar__430x932.png) | [PASS](screenshots/entrar__768x1024.png) | [PASS](screenshots/entrar__1366x768.png) | [PASS](screenshots/entrar__1536x864.png) | [PASS](screenshots/entrar__1920x1080.png) | [PASS](screenshots/entrar__3840x2160.png) |
| `/cadastro` | [PASS](screenshots/cadastro__375x812.png) | [PASS](screenshots/cadastro__430x932.png) | [PASS](screenshots/cadastro__768x1024.png) | [PASS](screenshots/cadastro__1366x768.png) | [PASS](screenshots/cadastro__1536x864.png) | [PASS](screenshots/cadastro__1920x1080.png) | [PASS](screenshots/cadastro__3840x2160.png) |
| `/recuperar-senha` | [PASS](screenshots/recuperar-senha__375x812.png) | [PASS](screenshots/recuperar-senha__430x932.png) | [PASS](screenshots/recuperar-senha__768x1024.png) | [PASS](screenshots/recuperar-senha__1366x768.png) | [PASS](screenshots/recuperar-senha__1536x864.png) | [PASS](screenshots/recuperar-senha__1920x1080.png) | [PASS](screenshots/recuperar-senha__3840x2160.png) |
| `/profissional/profile-18` | [PASS](screenshots/profissional_profile-18__375x812.png) | [PASS](screenshots/profissional_profile-18__430x932.png) | [PASS](screenshots/profissional_profile-18__768x1024.png) | [PASS](screenshots/profissional_profile-18__1366x768.png) | [PASS](screenshots/profissional_profile-18__1536x864.png) | [PASS](screenshots/profissional_profile-18__1920x1080.png) | [PASS](screenshots/profissional_profile-18__3840x2160.png) |
| `/empresa/accenture` | [PASS](screenshots/empresa_accenture__375x812.png) | [PASS](screenshots/empresa_accenture__430x932.png) | [PASS](screenshots/empresa_accenture__768x1024.png) | [PASS](screenshots/empresa_accenture__1366x768.png) | [PASS](screenshots/empresa_accenture__1536x864.png) | [PASS](screenshots/empresa_accenture__1920x1080.png) | [PASS](screenshots/empresa_accenture__3840x2160.png) |
| `/profissao/administracao` | [PASS](screenshots/profissao_administracao__375x812.png) | [PASS](screenshots/profissao_administracao__430x932.png) | [PASS](screenshots/profissao_administracao__768x1024.png) | [PASS](screenshots/profissao_administracao__1366x768.png) | [PASS](screenshots/profissao_administracao__1536x864.png) | [PASS](screenshots/profissao_administracao__1920x1080.png) | [PASS](screenshots/profissao_administracao__3840x2160.png) |
| `/reality-check/desenvolvimento-de-software` | [PASS](screenshots/reality-check_desenvolvimento-de-software__375x812.png) | [PASS](screenshots/reality-check_desenvolvimento-de-software__430x932.png) | [PASS](screenshots/reality-check_desenvolvimento-de-software__768x1024.png) | [PASS](screenshots/reality-check_desenvolvimento-de-software__1366x768.png) | [PASS](screenshots/reality-check_desenvolvimento-de-software__1536x864.png) | [PASS](screenshots/reality-check_desenvolvimento-de-software__1920x1080.png) | [PASS](screenshots/reality-check_desenvolvimento-de-software__3840x2160.png) |

## Interações e verificações

| Verificação | Resultado | Evidência |
|---|---|---|
| Páginas públicas e axe-core em desktop e mobile | PASS — 30 testes E2E | `npm run test:e2e -- e2e/public-pages.spec.ts` |
| Navegação da busca para perfil público | PASS em desktop e mobile | E2E `perfil público abre a partir da busca` |
| Rotas protegidas sem sessão | PASS para `/dashboard`, `/consultor`, `/admin` e `/dashboard/mensagens` | E2E `áreas privadas pedem login` |
| Contraste dos tokens | PASS — 7 testes | `npm test -- src/lib/contrast.test.ts` |
| ESLint | PASS — 0 erros, 2 avisos preexistentes em scripts auxiliares de `output/playwright` | `npm run lint` |
| Espaços no diff | PASS | `git diff --check` |
| Movimento reduzido e hidratação na home | PASS após correção, em 375×812 e 3840×2160; sem erros de console e sem overflow | `screenshots/home__375x812__retest.png`, `screenshots/home__3840x2160__retest.png` |

Os testes axe seguem a configuração existente do projeto, que desativa a regra automática de contraste por falsos positivos; a verificação separada dos tokens passou.

## Achado confirmado e correção

- **QA-01 — médio — hidratação com movimento reduzido.** Na execução inicial, a home produziu aviso de hydration mismatch em todas as sete larguras: o servidor renderizava a animação com estado inicial oculto, enquanto o primeiro render do cliente podia desativá-la ao detectar a preferência de movimento reduzido. A marcação inicial foi estabilizada em `src/components/story-motion.tsx`; Motion mantém a redução do movimento posicional. Repeti a matriz completa: zero erros de console nas 119 combinações; smoke checks em 375×812 e 3840×2160 também passaram.

## Sugestão opcional

Na primeira visita, o aviso de cookies fixo pode cobrir parte do conteúdo ou ações secundárias no primeiro viewport até a pessoa aceitar ou recusar. O aviso oferece as duas escolhas e pode ser fechado por elas; não causou overflow. Vale considerar uma versão mais compacta em telas baixas.

## Limitações

- As áreas autenticadas completas não foram percorridas. O fluxo E2E autenticado do projeto exige uma service key e um Supabase de teste dedicado; este ambiente contém apenas os arquivos de exemplo. A matriz inclui verificações de redirecionamento sem sessão, não uma sessão real de cliente, consultor ou administrador.
- Os exemplos dinâmicos representam os modelos de página; não foram testados todos os registros de perfil, empresa e profissão.
- A validação foi em Chromium local. Outros motores, navegadores, zoom do sistema, escalas de pixel e televisões físicas não foram testados. CSS responsivo e viewport `device-width` foram verificados nas dimensões do navegador listadas.
- Os screenshots do baseline estão em `baseline-screenshots/`; a matriz final está em `screenshots/`. Alguns arquivos extras documentam o reteste focado da home.

## Resumo

- **Matriz final:** 17 rotas/modelos × 7 viewports = 119 PASS.
- **E2E público:** 30/30 PASS.
- **Overflow horizontal:** nenhum encontrado.
- **Erros de console, imagens quebradas e requisições HTTP falhas na matriz final:** nenhum encontrado.
- **Resultado geral:** PASS COM LIMITAÇÕES, pela falta de sessão Supabase de teste para revisar as telas privadas autenticadas.