# Design System da Insidely

## Direção

“Clareza radical com calor humano.” A interface usa escala tipográfica incomum, planos cromáticos extensos e formas quase editoriais para transformar uma decisão ansiosa em uma investigação ativa.

## Princípios reinterpretados da referência

- navegação fixa em cápsula para preservar orientação durante páginas longas;
- hero de tela cheia com uma única afirmação dominante;
- cartões de narrativa empilhados e vinculados ao scroll;
- transições contínuas por cor, geometria e escala, não por blocos genéricos isolados;
- títulos expressivos e corpo sóbrio para separar emoção de informação operacional;
- microinterações curtas em hover/foco, sem sacrificar legibilidade;
- `prefers-reduced-motion` respeitado em CSS e nos componentes de animação.

## Tokens

| Papel | Token | Valor |
|---|---|---|
| Tinta | `--ink` | `#151714` |
| Papel | `--paper` | `#f2f0e9` |
| Verde mineral | `--mineral` | `#bbef74` |
| Verde profundo | `--forest` | `#315d43` |
| Âmbar | `--amber` | `#f1b54b` |
| Azul contextual | `--blue` | `#8ebef0` |
| Rosa editorial | `--pink` | `#e8a9c9` |

Títulos usam uma pilha rounded do sistema; texto usa uma pilha sans nativa. Isso evita dependência de download de fontes no build.

## Movimento

- CSS mantém formas orgânicas e feedback de interação.
- Motion controla entrada progressiva e prefere movimento reduzido quando solicitado pelo sistema.
- GSAP + ScrollTrigger relaciona a transformação dos cartões à posição de leitura.
- nenhuma animação bloqueia ação, esconde informação essencial ou depende apenas de movimento para comunicar estado.

## Componentes

- `SiteHeader`: navegação pública fixa e sessão contextual.
- `ProfessionalCard`: identidade pública derivada das escolhas de privacidade.
- `CompanyCard` e `ProfessionCard`: acesso aos recortes de contexto.
- `StoryMotion`: narrativa editorial por scroll.
- `DashboardShell`: estrutura consistente para os três papéis.
- `AuthForm`: formulários progressivos com mensagens de erro acessíveis.
