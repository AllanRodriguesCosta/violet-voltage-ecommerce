# Validação realizada

Data: 21/09/2026. Ambiente: Windows, Node.js 24.11.1, armazenamento em memória. Nenhuma chamada a uma conta Azure real ou ao deploy do Render foi realizada.

## Resultados finais

| Verificação | Resultado observado |
| --- | --- |
| Instalação npm | Concluída; auditoria automática: 0 vulnerabilidades conhecidas |
| `npm run lint` | Código de saída 0; sem erros ou avisos de lint |
| `npm test` | 17 testes aprovados, 0 falhas |
| `npm start` | Servidor iniciou na porta 3001 e foi encerrado após o teste |
| `npm run seed` | Servidor demonstrativo na porta 3000, com 8 produtos |
| `/api/health` | HTTP 200; `status: ok`, `storage: memory-development` |
| Páginas e arquivos estáticos | Nove páginas servidas; 14 referências únicas dos HTML conferidas, nenhuma quebrada |
| Página desconhecida | HTTP 404 com página amigável |
| Console do navegador | Nenhum erro ou aviso capturado nas páginas públicas inspecionadas |
| Segredos persistentes | Apenas `.env.example`, com campos secretos vazios; nenhum `.env` criado |
| Git | Nenhum comando Git executado durante o desenvolvimento |

## Cobertura automatizada

- Validação de produto, e-mail, quantidades, categorias, payload e valores monetários.
- Recusa de memória em produção, necessidade de configuração Azure e nomes dos recursos.
- Seed idempotente.
- Cadastro, login, cookie HttpOnly/SameSite e Secure em produção, logout e desativação de sessão após exclusão lógica.
- Bloqueio de acesso anônimo, papel customer sem privilégios administrativos e origem externa recusada.
- Limite de tentativas de autenticação.
- CRUD de produtos e clientes, filtros e alterações de status.
- Checkout ignora preços enviados pelo cliente, preserva snapshots, valida estoque, evita duplicação com requestId e impede duas compras da última unidade no processo.
- Compensação do estoque ao simular falha de gravação de pedido.
- Upload rejeita conteúdo incompatível e tamanho excessivo; substituição e exclusão limpam o blob do produto no adaptador em memória.
- Histórico próprio e preservação de pedidos depois de excluir produto/cliente.

## Navegador e responsividade

Inspeção visual e medição de largura do DOM:

| Tela | Larguras verificadas | Resultado |
| --- | --- | --- |
| Home/catálogo | 360, 768, 1280 px | Sem transbordamento horizontal; imagens carregadas |
| Produto | 360 px | Sem transbordamento; campos rotulados |
| Carrinho | 360, 768, 1280 px | Quantidade e subtotal atualizados; layout ajustado para tablet |
| Login | 360 px | Campos rotulados; sem transbordamento |
| Cadastro | 360 px | Campos rotulados; sem transbordamento |
| 404 | 768 px | Página amigável sem transbordamento |

Também foram exercitados o menu móvel, filtro por categoria, abertura de detalhes, adição ao carrinho, mudança de quantidade e redirecionamento do checkout para login. Nenhuma imagem quebrada ou campo sem label foi encontrado nas telas auditadas. A verificação é básica, não uma certificação completa WCAG.

As rotas e regras autenticadas de checkout, conta e administração foram testadas por HTTP. Não foi realizada uma sessão visual autenticada completa do painel e do checkout no navegador, pois não foi configurada uma credencial persistente de demonstração. Os testes geram valores aleatórios descartáveis somente em memória e não imprimem senhas ou tokens.

## Comandos executados

- Inspeção: `Get-ChildItem`, `Get-Content`, `rg --files`, `node --version`, `npm --version`.
- `npm install` (a primeira tentativa encontrou bloqueio no cache; a segunda, autorizada, concluiu).
- `npm install --save-dev eslint@^10 prettier@^3` para versão suportada do lint e formatação.
- `node scripts/create-pages.js` durante a criação inicial. O gerador temporário foi removido; os HTML finais são arquivos estáticos editáveis.
- `npx prettier --write ...` nos arquivos JavaScript, CSS, HTML e configurações criados.
- `npm run lint` e `npm test`, com correções e nova execução após falhas encontradas.
- `node scripts/seed.js`, depois `npm run seed`, com `DEV_MEMORY_STORAGE=true` e porta 3000.
- `npm start`, com `DEV_MEMORY_STORAGE=true` e porta 3001, somente para verificar a inicialização padrão.
- Requisições locais por `Invoke-RestMethod` e `fetch` do Node para saúde, páginas e referências.
- Scripts Node locais de edição/verificação e controles do navegador para inspeção visual.

## Pendências externas e limites

- Preencher as variáveis Azure e administrativas no ambiente privado; não há administrador padrão.
- Validar criação dos três recursos Table e do contêiner, persistência, ETags e upload/proxy contra uma conta Azure real.
- O adaptador Azure está implementado, mas os testes de integração usam memória. Não foi emulado o serviço Azure.
- Publicar manualmente no Render conforme README; ainda não existe URL pública implantada.
- Conferir as telas autenticadas com as credenciais configuradas e fazer uma compra de demonstração após o deploy.
- Memória é volátil. Transações entre tabelas/partições Azure não são atômicas; falhas de rede/processo podem precisar de conciliação. Cancelamento não repõe estoque automaticamente. Essas limitações estão detalhadas no README.
