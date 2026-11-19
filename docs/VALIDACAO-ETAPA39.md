# Validação da migração React — 19/11/2026

Revisão do pacote `violet-voltage-etapa39.zip`, aplicado sobre a etapa 38
(`10a6c2f`). A aplicação foi executada em uma cópia isolada, sem `.env`, banco
de produção ou chave Gemini. As alterações locais da pasta principal foram preservadas.

## Escopo conferido

- 22 páginas com entradas React/TypeScript, build Vite e pré-render.
- Catálogo, produto, favoritos, comparação, carrinho, checkout, autenticação,
  conta, pedidos, montador, kits, encomenda, parceiros, guias, ajuda e painel.
- Cabeçalho, busca, minicarrinho, tema e interface do assistente em React.
- Rotas HTML existentes e contratos HTTP mantidos; cálculo do pedido no servidor.
- Geração do frontend incluída nos fluxos de CI, Docker e Render.

## Ajustes feitos durante a revisão

- Lockfile atualizado dentro das faixas compatíveis: Vite 7.3.8, ESLint 10.15.0
  e dependências transitivas corrigidas. A instalação limpa passou e a auditoria
  npm não reportou vulnerabilidades na data da verificação.
- Teste de Content-Type aceita o parâmetro válido `charset=utf-8`, preservando
  a verificação do tipo `application/speculationrules+json` e do conteúdo JSON.
- Leitura textual de três arquivos de testes normaliza CRLF; teste de sintaxe
  Bash converte URL de arquivo para caminho nativo. Nenhum teste foi desativado.

## Resultados locais

- `npm ci --include=dev --ignore-scripts`: aprovado com o lockfile final.
- `npm run typecheck` e `npm run lint`: aprovados.
- `npm run build`: aprovado, com 22 páginas pré-renderizadas.
- `npm test`: **235 aprovados, zero falhas, zero ignorados** após os ajustes.
  No Windows foi usado o Bash do Git no PATH para os testes de infraestrutura.
- Navegador Chromium com servidor em memória: **210 verificações aprovadas**:
  `smoke.mjs` (12), `conta.mjs` (70), `react-etapa4.mjs` (40),
  `react-etapa5.mjs` (88). Incluem fluxos de erro, compra, conta, painel,
  assistente local e ausência de rolagem lateral nas páginas verificadas a 375 px.
  Esses roteiros locais rodaram antes da atualização final das ferramentas de build;
  a execução no CI deve confirmar novamente o conjunto final.

## Limites e publicação

Não foi realizada compra real, chamada ao Gemini com chave real ou alteração no
PostgreSQL de produção. A interface do assistente foi testada com o motor local.
Docker e Lighthouse dependem da validação no CI; o teste local não os substitui.

Para serviço Render criado manualmente, configurar antes do deploy:

```text
Build Command: npm ci --include=dev && npm run build && npm prune --omit=dev
Start Command: npm start
```

As variáveis existentes de banco, certificado, sessão e Gemini permanecem no Render.
O arquivo `render.yaml` não altera automaticamente um serviço criado manualmente.
