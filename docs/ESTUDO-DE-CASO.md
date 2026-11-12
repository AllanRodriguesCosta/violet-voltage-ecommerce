# Violet Voltage: de projeto acadêmico a portfólio

## Problema e objetivo

A primeira versão dependia de recursos Azure disponibilizados para a atividade
acadêmica. Quando esse acesso terminou, o código e o frontend continuavam
disponíveis, mas a aplicação perdeu sua persistência. O objetivo passou a ser
restaurar o site com infraestrutura controlada pelo autor e evoluir a experiência
para demonstrar desenvolvimento full stack, sem operar uma loja real.

O catálogo foi reconstruído a partir do manifesto e das 22 imagens locais.
Isso não recupera os clientes ou pedidos do banco anterior: sem exportação,
esses registros não podem ser recriados a partir do código.

## Arquitetura atual

```mermaid
flowchart LR
    V[Visitante] --> F[HTML, CSS e JavaScript]
    F --> E[Express: páginas e API]
    E --> A[Autenticação e autorização]
    E --> S[Serviços: checkout e catálogo]
    S --> R[Repositório PostgreSQL]
    A --> R
    R --> P[(Supabase: schema violet_voltage)]
    E --> I[Proxy de imagens]
    I --> R
```

O Express é hospedado no Render. Somente o backend conhece a conexão PostgreSQL.
O frontend usa a API da aplicação; não consulta a Data API do Supabase nem
recebe credenciais do banco. O modo em memória existe para desenvolvimento e
demonstrações descartáveis; a configuração o proíbe em produção.

## Decisões e contrapartidas

| Decisão | Motivo | Limite assumido |
| --- | --- | --- |
| Manter Express e JavaScript sem frameworks | Preservar a base e concentrar o trabalho na experiência e persistência | Organização de estado e componentes exige disciplina própria |
| Adaptador PostgreSQL com contrato de repositório | Trocar infraestrutura sem reescrever todas as rotas | Nomes como partitionKey e etag permanecem como compatibilidade |
| Registros JSONB com chaves, versões e restrições SQL | Preservar o formato dos dados durante a migração | Não é um modelo relacional totalmente normalizado |
| Imagens em bytea | As 22 fontes somam cerca de 3,28 MB; um serviço de dados basta para a demonstração | Não é a escolha proposta para um grande catálogo de mídia |
| Autenticação própria existente | Manter bcrypt, cookie HttpOnly e autorização backend | Recuperação de senha e revogação completa de sessões não foram implementadas |
| Testes PostgreSQL via PGlite | Testar SQL e rollback sem credenciais cloud no CI | Não reproduz rede TLS, infraestrutura hospedada ou múltiplas instâncias |

## Integridade do pedido

O navegador envia IDs e quantidades. O servidor relê os produtos, verifica
disponibilidade e calcula subtotal e frete em centavos inteiros. Valores
monetários enviados pelo cliente não determinam o preço final.

No PostgreSQL, baixa de estoque e criação do pedido fazem parte da mesma
transação serializável. Uma falha reverte ambas. Versões detectam atualizações
concorrentes e erros de serialização têm tentativas limitadas. O identificador
requestId, combinado com o cliente, permite devolver um pedido já registrado.

Isso não equivale a uma garantia financeira de processamento exatamente uma
vez sob toda falha distribuída. O projeto não integra gateway, cobrança, frete
real ou infraestrutura de conciliação. Cancelamento de status não repõe estoque
automaticamente.

## Evolução da experiência

As melhorias locais incluem identidade visual musical, filtros removíveis,
ordenação, parâmetros compartilháveis na URL e dados do produto organizados.
O trabalho de acessibilidade inclui foco ao confirmar pedido, fechamento do
menu com Escape e filtros recolhíveis em telas pequenas.

Falhas recebem ações de recuperação: consultar histórico novamente, recarregar
carrinho e tentar consultar produto. Falha de rede ao verificar sessão é
diferenciada de ausência de autenticação. Se o pedido foi salvo, mas a limpeza
do carrinho local falhou, a confirmação permanece visível.

Essas funcionalidades estão implementadas localmente; a revisão visual e das
interações ainda está pendente. Não se afirma conformidade formal de
acessibilidade ou publicação de todas as melhorias.

## Evidências e limites da validação

- Última suíte completa observada: 33 testes aprovados e lint aprovado.
- Cobertura inclui autenticação, autorização, checkout, estoque, imagens, seed,
  rollback PostgreSQL e testes de cliente para falhas de comunicação/carrinho.
- Seed cloud confirmado com 22 produtos e 22 imagens legíveis em nova conexão.
- Funcionamento da versão migrada no Render confirmado pelo autor.
- CI no GitHub Actions aprovado na primeira execução remota, em 10/11/2026, e
  executado em cada pull request para `main`.
- Sem medições publicadas de desempenho, auditoria visual completa ou testes
  de carga. Os resultados automatizados não substituem essas verificações.

Resultados históricos e limites estão em [VALIDACAO.md](../VALIDACAO.md).
O [roteiro de demonstração](DEMONSTRACAO.md) orienta uma apresentação com dados
fictícios, incluindo o painel sem divulgar acesso administrativo.

## Fase 3 (12/11/2026)

Em um dia, nove etapas (17 a 25, PRs #12 a #20), todas com CI verde:
ficha técnica e catálogo de 80 produtos, assistente de compras com PLN local,
conta com privacidade, comparador, kits, compatibilidade no carrinho,
serviços, guias, aviso de preço, perguntas e respostas, SEO no servidor,
indicadores do painel, trocas pelo comprovante, assistente que age com
confirmação e reforço opcional com o Gemini gratuito. Decisão de custo zero:
nenhuma biblioteca nova e nenhum serviço pago. Resumo para quem continua o
trabalho: [CONTEXTO-CODEX.txt](CONTEXTO-CODEX.txt).

## Próximos marcos

Publicar as etapas 17 a 25 no Render, carregar as 58 fotos novas, ligar o
Gemini se desejado e medir o site publicado (Lighthouse e capturas), conforme
[PENDENCIAS-MANUAIS.txt](PENDENCIAS-MANUAIS.txt). Ferramentas de estudo
(afinador, metrônomo, tablaturas) ficam para um site separado, ligado à loja
depois.
