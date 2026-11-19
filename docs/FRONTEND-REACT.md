# Frontend em React + TypeScript (etapa 39)

O frontend da Violet Voltage é **React 19 + TypeScript**, com **Vite 7** no build. A migração
do HTML + JavaScript puro foi feita **página a página** (etapas 39.1 a 39.5) e está concluída:
todas as páginas e recursos globais estão em React e o frontend antigo (`public/*.html` e
`public/js`) foi removido.

## Como funciona

- **Uma página HTML por endereço, como antes.** Os endereços não mudam (`/`, `/catalogo.html`,
  `/produto.html?id=...`). Não usamos um site de página única com React Router: assim o SEO feito
  no servidor (`src/http/seo.js`), o `sitemap.xml`, os links que o assistente devolve e a leitura
  do site pelo Agent_generator continuam funcionando sem mudança.
- **Pré-render.** No build, cada página é renderizada em Node (`renderToString`) e o HTML vai
  pronto para `dist/<pagina>.html`. Buscadores, prévias de link e quem está sem JavaScript veem o
  cabeçalho, os textos e os links. No navegador, o React "hidrata" esse HTML (`hydrateRoot`).
- **Mesmo visual.** Os componentes geram as mesmas classes e ids do layout anterior; o CSS
  (`web/src/styles/style.css` e `ui.css`) é o mesmo, empacotado pelo Vite.
- **Regras compartilhadas.** O que o servidor, a loja e os testes usam juntos (ficha técnica,
  preços, kits, compatibilidade, frete por região, serviços, catálogo, pedidos...) fica em
  `shared/`, em JavaScript puro com JSDoc, sem DOM nem APIs do Node.
- **Mesma API.** Nada muda no backend, no banco ou no motor do assistente.

## Pastas

```
web/                      raiz do Vite
  <pagina>.html           um HTML por página (head com SEO + <div id="root">), 22 páginas
  src/
    entries/<pagina>.tsx  entrada de cada página (chama mount; offline só traz o CSS)
    pages/                componentes de página + pages/index.ts (registro do pré-render)
    components/           Layout, ProductCard, KitCard, State, Form/FormKit, Private,
                          CartDrawer (minicarrinho e aviso), SearchBox, CompareTray,
                          QuickView, Assistant, AdminDashboard, Portal...
    lib/                  estado do navegador em TypeScript: api, cart (carrinho, favoritos,
                          buscas recentes), checkout, session, store, alerts, priceAlerts,
                          compare, notifications, drawer, quickview, motion, toast, confirm,
                          submit, theme; shop.ts e catalog.ts reúnem o que as páginas usam
    styles/               style.css, ui.css e react.css
    mount.tsx             hidrata ou renderiza a página dentro do Layout
    prerender.tsx         entrada do pré-render (Vite SSR)
shared/                   regras usadas pelo servidor, pela loja e pelos testes (JS puro)
scripts/prerender.js      grava o HTML pré-renderizado em dist/
dist/                     saída do build (ignorada pelo Git)
public/                   fontes, ícones, imagens, manifest.webmanifest, sw.js e
                          js/theme-init.js (script clássico que aplica o tema antes do CSS)
```

O Express serve `dist/` e depois `public/`. Arquivos do build têm hash no nome e cache longo
(`immutable`); HTML continua com `no-cache`. Endereços desconhecidos recebem `dist/404.html`
com status 404.

### Recursos globais

O `Layout` liga, em todas as páginas, o minicarrinho e o aviso "Adicionado ao carrinho" (com o
produto voando até o ícone), a barra de comparação, a visualização rápida e o assistente. Eles
são renderizados no `<body>` (portal) só depois da hidratação, como antes. O minicarrinho e a
visualização rápida abrem por `openCart()` (`lib/drawer.ts`) e `openQuickView()`
(`lib/quickview.ts`); o aviso escuta o evento `vv:cart-added` de `addCart`. O contador de
notificações do cabeçalho e da navegação inferior vem de `lib/notifications.ts` (`useUnread`),
que a sessão inicia e Minha conta atualiza ao ler ou apagar notificações.

### Desempenho e robustez (39.6)

- **Arquivos do build.** React, React DOM e scheduler saem em `app/react-HASH.js`
  (`manualChunks` em `vite.config.ts`): mudam pouco, então o navegador reaproveita o cache entre
  publicações. O assistente e a visualização rápida são `lazy()` no `Layout` e só baixam depois
  da hidratação. Recurso global novo e pesado deve seguir o mesmo caminho (`<Widget>` no Layout).
- **Erros.** A página fica dentro de `<ErrorBoundary area="página">` (aviso com "Recarregar" e
  "Ir para o início"); cada recurso global fica num `<Widget>` com `fallback={null}`, então um
  erro no assistente não derruba a página. O erro vai para o console com a área.
- **API.** `lib/api.ts` tenta de novo as leituras (GET) em queda de conexão e 502/503/504 (600 ms
  e 1,8 s). Envios (POST, PUT, PATCH, DELETE) nunca repetem sozinhos.
- **Fotos.** Imagem que falha vira `data-fallback` (ou `/assets/product.svg`), uma vez só
  (`lib/browser.ts`). O `ProductCard` já informa a ilustração da categoria.
- **Conexão.** Aviso (toast) quando a conexão cai e quando volta.
- **Pré-carregamento.** O servidor manda `Speculation-Rules: "/speculation-rules.json"` nas
  páginas; Chrome e Edge baixam a página de um link quando o cursor para sobre ele. Regras em
  `shared/speculation.js` (fora: API, painel, checkout, pedido e links com `data-no-prefetch`).
  Não use `<script type="speculationrules">` inline: a CSP bloqueia.

### Offline

`web/offline.html` é pré-renderizada sem o `Layout` e sem hidratação (`bare` em
`pages/index.ts`). O service worker (`public/sw.js`) guarda `/offline.html` e, na instalação, os
arquivos de `/app/` citados por ela (o CSS com hash), para a página sem conexão manter o visual.

### Testes do frontend no Node

`tests/helpers/web.js` deixa os testes importarem `web/src` (TypeScript e JSX, convertidos pelo
esbuild do Vite): `const { addCart } = await web("lib/cart.ts")`, e `html(elemento)` gera a
marcação de um componente. Testes que leem páginas do build pulam quando `dist/` não existe.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run build` | Vite (uma entrada por página) + pré-render. Gera `dist/`. |
| `npm run dev` | Recompila o frontend a cada alteração e reinicia o servidor (http://localhost:3000). |
| `npm run typecheck` | Checa os tipos do TypeScript. |
| `npm start` | Servidor (serve `dist/` se existir). |

**Sem `npm run build` não há páginas** (só a API e os arquivos de `public/`). Render, Docker,
Azure e o CI já rodam o build; `npm test` funciona sem ele, pulando os testes que leem `dist/`.

## Regras para criar ou alterar uma página

1. Crie `web/<pagina>.html` com o `<head>` de SEO (título, descrição, Open Graph e o
   `<script src="/js/theme-init.js">`, sem CSS) com `<div id="root"></div>` e
   `<script type="module" src="/src/entries/<pagina>.tsx"></script>`.
2. Crie `web/src/pages/<Nome>.tsx` com a mesma marcação (classes e ids) e registre em
   `web/src/pages/index.ts`. Crie `web/src/entries/<pagina>.tsx` chamando `mount(<Nome>)`.
3. **Nada de `window`, `document` ou `localStorage` durante o render**: o pré-render roda em
   Node. Leia o navegador em `useEffect` ou com os hooks de `lib/store.ts`
   (`useSyncExternalStore` com valor de servidor), senão a hidratação diverge.
4. Lógica da loja (preços, carrinho, kits, regiões) vem de `lib/shop.ts`, `lib/catalog.ts` ou de
   `shared/`; não duplique regras de negócio no componente. Regra nova usada também pelo servidor
   vai para `shared/` (sem DOM).
5. Recursos fora da página (minicarrinho, aviso, toast, confirmação) usam `openCart`, `toast` e
   `confirmDialog` de `lib/`, não manipulação direta do DOM.
6. Rode `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` e os roteiros de
   navegador (`node scripts/e2e-server.js` + `node tests/e2e/smoke.mjs`, `conta.mjs`,
   `react-etapa4.mjs` e `react-etapa5.mjs`).
7. Formulários usam `components/Form.tsx` (`<Form>`, `<Input>`, `<SubmitButton>`); páginas que
   exigem login usam `<Private>` de `components/Private.tsx`.

## Etapas da migração

| Etapa | Conteúdo | Situação |
| --- | --- | --- |
| 39.1 | Base (Vite, TypeScript, pré-render, build no Render/Docker/Azure/CI), Layout completo (cabeçalho, menu "Olá", menus, rodapé, tema), cartões de produto e kit, página inicial | feito |
| 39.2 | Catálogo, produto (galeria e cores), comparar, favoritos | feito: as quatro páginas em React com pré-render, mesmo visual e estado no endereço (filtros, `?cor=`, `?ids=`) |
| 39.3 | Carrinho, checkout, pedido, minha conta, login e cadastro | feito: páginas em React com formulários acessíveis (`components/Form.tsx`), sessão das páginas privadas (`components/Private.tsx`) e roteiro `tests/e2e/conta.mjs` |
| 39.4 | Montador de setup, kits, encomenda, parceiros, guias | feito: páginas em React com pré-render (guias e glossário completos no HTML), formulários com `FormKit`, roteiro `tests/e2e/react-etapa4.mjs` |
| 39.5 | Ajuda, termos, privacidade, 404, offline, painel; minicarrinho, busca, avisos, comparação e assistente em React; remoção de `public/js` e das páginas antigas | feito: todas as páginas e recursos globais em React, regras compartilhadas em `shared/`, estado do navegador em `web/src/lib` (TypeScript), CSS em `web/src/styles`, roteiro `tests/e2e/react-etapa5.mjs` |
| 39.6 | Refinamentos: React em arquivo próprio, assistente e visualização rápida sob demanda, isolamento de erros, nova tentativa em leituras da API, foto substituta, aviso de conexão, pré-carregamento de páginas | feito: ver "Desempenho e robustez" e `tests/stage39-6.test.js` |
