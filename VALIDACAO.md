# Migração PostgreSQL — 07/11/2026

- `npm run lint`: aprovado, saída 0.
- `npm test`: 28 testes aprovados, zero falhas. Execução com permissão de rede local para os testes HTTP.
- PostgreSQL via PGlite: migração repetível, 22 produtos/imagens, atualização por versão, conflitos e rollback de estoque/pedido e imagem.
- Integração HTTP com esse adaptador: autenticação, cookie HttpOnly, autorização, imagem binária, checkout e histórico.
- TLS configurado com validação de certificado; credenciais nunca registradas.
- Dependências atualizadas sem troca de versões principais. Auditoria após atualização: três alertas moderados na cadeia de desenvolvimento ESLint/minimatch; não aplicado `audit fix --force`.
- Supabase/Render reais ainda não verificados: dependem da criação do projeto e configuração privada de conexão. PGlite não verifica transporte TCP/TLS, persistência cloud ou concorrência entre várias instâncias.
- Nenhuma operação Git, publicação externa, alteração visual ou integração de agente nesta etapa. As observações visuais abaixo são históricas.

---
# Validação do catálogo com imagens

Atualização: 21/09/2026. Ambiente local: Windows, Node.js 24.11.1, armazenamento em memória. Nenhuma operação Git, conexão com Azure real ou publicação no Render foi realizada nesta atualização.

## Resultados

| Verificação | Resultado observado |
| --- | --- |
| `npm run lint` | Aprovado, saída 0 |
| `npm test` | 24 testes aprovados; 0 falhas |
| `npm run seed` em memória | 22 produtos criados; 22 imagens enviadas ao adaptador |
| Imagens de origem | 22 arquivos PNG válidos pelo cabeçalho; 3.281.878 bytes no total |
| `/api/health` | HTTP 200; `{ "status": "ok", "storage": "memory-development" }`; campo `payment` removido |
| Catálogo | 22 produtos; IDs `demo-001` a `demo-022` |
| Proxy de imagens | 22 respostas HTTP 200, `image/png`, conteúdo idêntico ao arquivo original em disco |
| Busca final em `public/` | Nenhuma ocorrência de `demonstr`, `simulad` ou `nenhuma cobrança` |
| Console do navegador | Nenhum erro/aviso capturado nas telas percorridas |
| Segredos | Nenhuma connection string ou credencial real utilizada, incluída em arquivo ou impressa |
| Arquivos privados | `seed-assets/produtos-violet-voltage/` incluído em `.gitignore`; originais preservados |

## Seed e testes automatizados

- Manifesto de 22 itens, seis categorias, IDs e caminhos únicos; estoques entre 5 e 30 e preços em centavos inteiros.
- Atualização dos oito IDs antigos em partições diferentes, sem criar duplicatas; preservação de `createdAt` e PartitionKey, atualização de `updatedAt`.
- Criação dos demais 14 registros, com nomes de blob determinísticos, MIME PNG e versão de URL derivada do conteúdo.
- Segunda execução mantém 22 produtos e 22 nomes de blob, atualizando os mesmos IDs.
- Produtos manuais e blobs manuais permanecem intactos, inclusive imagens antigas associadas a um produto seed.
- Pasta ausente, arquivo final ausente e PNG inválido são rejeitados antes de qualquer upload/cadastro.
- Duplicações antigas de uma RowKey entre partições são detectadas antes das gravações.
- Os 22 produtos e as 22 imagens continuam acessíveis por HTTP após repetir o seed.
- O contrato do adaptador Azure foi exercitado com clientes substitutos em memória. Isso não é validação de conectividade com Azure real.
- Os testes usam fixtures PNG temporárias e não dependem das imagens privadas ignoradas pelo Git.
- Mantidos os testes de autenticação, autorização, cookies, rate limit, CRUD, uploads administrativos, checkout, estoque, concorrência, compensação, idempotência de pedidos e páginas.

## Navegador

| Tela | Larguras verificadas | Resultado |
| --- | --- | --- |
| Catálogo | 360, 768, 1280 px | 22 cartões; sem transbordamento; imagens com `contain` e centralizadas |
| Produto | 360, 768, 1280 px | Guitarra inteira, carregada e centralizada; sem transbordamento |
| Carrinho | 360, 768, 1280 px | Miniaturas carregadas com `contain`; sem transbordamento |
| Checkout autenticado | 360, 768, 1280 px | Campos, resumo e opções Pix/Cartão/Boleto sem avisos removidos; sem transbordamento |

Foram exercitados filtro por categoria, detalhes da guitarra, adição ao carrinho, exigência de login, cadastro temporário, seleção de retirada/Pix, confirmação do pedido, carrinho limpo após confirmação, histórico com detalhes e logout. A confirmação mostrou **Pedido realizado com sucesso.** O histórico mostrou **Pagamento: pix**. A conta de teste foi criada somente na memória local, com senha aleatória não impressa. Não houve cobrança ou gateway financeiro.

As imagens do painel administrativo receberam miniatura na listagem e prévia no formulário de substituição, com tamanhos reservados, fundo claro, `contain` e centralização. O acesso administrativo e upload continuam cobertos pela suíte HTTP; não foi realizada sessão visual com administrador nesta atualização.

## Arquivos alterados/criados nesta atualização

- `.gitignore`.
- `src/services/seed.js` e novo `src/services/seed-products.js`.
- `scripts/seed.js` e `src/routes/api.js`.
- As nove páginas `public/*.html`: metadados; home e checkout também tiveram textos revisados.
- `public/js/app.js`, `public/js/common.js`, `public/js/admin.js`.
- `public/css/style.css`, `public/css/ui.css`.
- `tests/application.test.js`, novo `tests/seed.test.js` e novo `tests/helpers/seed-fixture.js`.
- `README.md`, `seed-assets/README.md`, `VALIDACAO.md`.

Os PNGs originais não foram editados nem copiados para `public`. Nenhuma dependência nova foi necessária. Não houve pesquisa externa de preços.

## Pendências externas

Para realizar o upload real, mantenha a pasta de imagens no computador, configure `AZURE_STORAGE_CONNECTION_STRING` e `JWT_SECRET` privadamente, defina `DEV_MEMORY_STORAGE=false` e execute `npm run seed`. A aplicação publicada deve usar a mesma conta Storage. Veja `seed-assets/README.md` para os comandos completos.

Ainda dependem das credenciais externas: criação/consulta dos recursos reais, permissões, persistência e upload/proxy no Azure e conferência do catálogo no Render. Os recursos permanecem `AllanRibeiroProdutos`, `AllanRibeiroClientes`, `AllanRibeiroPedidos` e `allan-ribeiro-produtos`.

O seed não roda automaticamente. Atualizações de Table e Blob não têm transação global: falhas remotas durante a carga exigem corrigir a causa e repetir o comando, que reutiliza os mesmos IDs. Reexecutar o seed restaura preços, estoque, imagens e dados dos IDs reservados; não altera produtos manuais com outros IDs.

