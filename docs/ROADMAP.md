# Roadmap de evolução — Violet Voltage

Objetivo: apresentar um portfólio profissional de desenvolvimento full stack, sem vendas reais. Manter Express, JavaScript sem frameworks, PostgreSQL e hospedagem atual. Agentes ficam para uma fase posterior.

Cada etapa termina com revisão local, correções e registro de evidências. Publicação ocorre após validar a versão; não executar Git sem solicitação do usuário.

## 1. Identidade visual e home — em andamento

Revisão desktop parcial realizada com capturas fornecidas pelo usuário: home,
catálogo, produto, carrinho, conta e checkout. Caminho de sucesso até o histórico
observado nas capturas. Revisão mobile, teclado e cenários de erro ainda pendente.

- [x] Definir direção: visual musical editorial, roxo profundo, lilás e superfícies claras.
- [x] Refinar abertura, hierarquia tipográfica, botões e cards do catálogo.
- [x] Acrescentar apresentação da marca e navegação para ela.
- [ ] Revisar visualmente home, produto e checkout em desktop e mobile.
- [ ] Ajustar detalhes identificados na revisão.

Critério de conclusão: identidade consistente entre páginas, textos legíveis, imagens sem cortes, links funcionais e ausência de rolagem horizontal em 360, 768 e 1440 px.

Validação da primeira implementação: lint aprovado e 28 testes aprovados. A prévia no navegador não alcançou o servidor local (timeout); revisão visual e medidas de viewport permanecem pendentes. Alterações ainda locais, sem publicação.

## 2. Catálogo e produto — próxima entrega

- [x] Ordenação por preço e nome; preservar busca e categoria na URL (implementado; revisão no navegador pendente).
- [x] Exibir filtros aplicados, limpeza rápida e resultados vazios com ação útil (implementado; validação de interação pendente).
- [x] Organizar descrição e especificações usando apenas dados disponíveis, sem inventar características (marca, modelo e categoria).
- [x] Implementar apresentação e validação de disponibilidade/quantidade; revisão mobile do produto pendente.

Critério: combinar filtros, atualizar a página e compartilhar a URL mantém os resultados; ordenação correta; produto ausente ou esgotado tem tratamento claro.

## 3. Mobile e acessibilidade

Prioridade atual: responsividade mobile e testes de interação/erro. Revisão de
navegação por teclado adiada por solicitação do usuário, sem marcar conclusão.
Layout mobile refinado; conferência visual em aparelho/navegador ainda pendente.

- [x] Menu móvel com fechamento por Escape e retorno do foco ao botão; fecha também ao selecionar link ou clicar fora (implementado; revisão mobile pendente).
- [x] Implementar filtros recolhíveis, áreas de toque e formulários mobile (validação completa pendente).
- [ ] Revisar contraste, títulos, labels, mensagens, teclado e zoom de 200%.
- [ ] Respeitar redução de movimento e conferir alternativas textuais.

Critério: completar navegação, cadastro e checkout por teclado e em tela pequena, sem conteúdo inacessível.

## 4. Acabamento dos fluxos

Em implementação: confirmação na página de produto com acesso ao carrinho,
validação defensiva de quantidade, mensagem para falha no armazenamento local
e recuperação de erro ao consultar produto. Revisão de interação pendente.

Confirmação de pedido refinada com foco, histórico e retorno ao catálogo.
Falha de limpeza local do carrinho não oculta sucesso já confirmado pelo servidor.
Testes de cliente cobrem quantidade inválida, estoque acumulado e armazenamento
bloqueado; não substituem a revisão no navegador.

- [ ] Padronizar carregamento, falha, vazio e sucesso em cada tela.
- [x] Implementar feedback do carrinho e prevenção de cliques repetidos; testes simulados aprovados.
- [x] Implementar recuperação de rede e mensagens nos fluxos principais; revisão no browser pendente.
- [x] Refinar confirmação e acesso ao histórico; sucesso observado em capturas desktop.
- [x] Planejar apresentação do painel com capturas fictícias, sem compartilhar administrador. Capturas ainda pendentes.

Critério: preço e estoque continuam validados pelo servidor; erros permitem nova tentativa; pedidos não duplicam; nenhuma integração financeira real.

## 5. Apresentação técnica

- [x] Preparar CI de lint e testes no GitHub Actions, sem credenciais de produção.
- [ ] Confirmar primeira execução real do CI no GitHub após envio autorizado.
- [ ] Atualizar README com capturas, arquitetura e instruções reproduzíveis.
- [x] Escrever estudo de caso: problema, decisões, migração Azure/PostgreSQL, testes e limites.
- [ ] Registrar medição de desempenho/acessibilidade e corrigir os problemas encontrados.
- [x] Preparar texto-base e roteiro em docs/DEMONSTRACAO.md (capturas pendentes).

Critério: clone novo roda conforme documentação; CI verde; evidências sem dados pessoais; materiais representam a implementação real.

## Depois das cinco etapas

Escolher um agente com utilidade comprovável, definir permissões e dados necessários, custo e avaliação. Nenhum agente será integrado durante este roadmap.

