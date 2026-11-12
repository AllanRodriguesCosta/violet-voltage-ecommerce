# Assistente de compras (Fase 3, etapas 19, 20, 24 e 25)

Agente conversacional da Violet Voltage, feito com processamento de linguagem
natural (PLN) local em JavaScript, sem bibliotecas, sem chave de API e sem
custo. Responde só com dados reais da loja (catálogo, estoque, regras de preço e
pedidos do próprio cliente) e nunca compra nada sozinho: ações como "adicionar ao
carrinho" dependem de um clique.

## O que ele faz

| Módulo | Exemplos de frase | Resposta |
| --- | --- | --- |
| Recomendação | "quero uma guitarra mais vintage", "pedal de overdrive até 900 reais", "tem algo da Boss?" | Até 3 produtos em estoque, com o motivo de cada um, e link para o catálogo já filtrado |
| Diálogo com afunilamento | "guitarra vintage" → "Qual som vintage você procura?" → "blues rock" | Pergunta o que falta (categoria, gênero, orçamento) uma vez só; "tanto faz" pula a pergunta |
| Produto pelo nome | "quanto custa a AC30?", "tem o DS-1?" | Preço, parcelas, estoque e descrição |
| Setup | "monta um setup de metal até 4 mil" | Guitarra, amplificador, pedal, cabo e correia dentro do orçamento, com "adicionar tudo" e link para o montador |
| Pedidos | "onde está meu pedido?", "quero cancelar" | Etapa do pedido mais recente (ou do código citado) e se ainda dá para cancelar |
| Dúvidas da loja | frete, prazos, retirada, pagamento, parcelas, cupons, trocas, conta | Texto gerado das mesmas regras do checkout (`src/services/pricing.js`) |
| Central de Ajuda | "o preço muda no carrinho?", "como excluo minha conta?", "vocês avisam quando voltar ao estoque?" | A resposta da pergunta mais parecida da Central de Ajuda, com link para ela (etapa 20) |
| Conversa | saudação, ajuda, agradecimento, despedida, assunto fora da loja | Respostas curtas, com sugestões de próxima pergunta |
| Ficha do produto (etapa 24) | "quantos trastes tem essa?", "o TS9 precisa de fonte?", "ela serve pra metal?" | Dados da ficha do produto citado, da página aberta ou da lista anterior |
| Comparação (etapa 24) | "compara a DS-1 com o RAT 2", "compara com a JS32" (na página de outro produto), "compara as duas primeiras" | Diferenças da ficha, estilos e preço, com link para a tabela do comparador |
| Ações com confirmação (etapa 24) | "adiciona essa ao carrinho", "adiciona a segunda", "aplica o cupom VOLTAGE10" | Botão para o cliente confirmar; nada muda sem o clique |
| Carrinho (etapa 24) | "o que falta no meu carrinho?" | As regras de compatibilidade do carrinho (cabo, amplificador, fonte, patch, kit), com botão para adicionar as sugestões; no carrinho, o botão do assistente mostra quantas dicas há |
| Orçamento e kits (etapa 24) | "tenho 3 mil para começar do zero" | Setup dentro do orçamento e o kit com desconto que cabe nele |
| Histórico e favoritos (etapa 24) | "algo com base no que eu comprei", "meus favoritos baixaram de preço?" | O que completa as compras e itens do mesmo estilo; preço de hoje contra o do aviso |
| Glossário (etapa 24) | "o que é humbucker?", "diferença entre fuzz e overdrive" | Definição do glossário com link para o termo e para o guia |
| Troca (etapa 24) | "quero trocar o pedal que comprei" | Se há pedido no prazo, o caminho para "Solicitar troca" no comprovante |
| Filtros novos (etapa 24) | "guitarra canhota", "de 7 cordas", "com captador ativo", "com 24 trastes" | Recomendação com esses filtros e link para o catálogo filtrado |

Disponível só para quem está logado (botão "Assistente" no canto da tela).

## Como funciona

```
mensagem ─► normalização ─► classificador de intenção (Naive Bayes) ─┐
         └► extração de entidades (regras) ─────────────────────────┼─► roteamento ─► módulo ─► resposta + contexto
contexto da conversa (vem do navegador, revalidado) ────────────────┘
```

1. **Pré-processamento** (`src/assistant/text.js`): minúsculas, sem acentos,
   vogal final alongada reduzida ("oii" → "oi"), palavras vazias removidas e
   radicalização leve inspirada no RSLP (plural, sufixos e terminações verbais:
   "guitarras" → "guitarr", "procurando" → "procur"). Os atributos são os
   radicais e os pares de radicais vizinhos.
2. **Intenção** (`classifier.js`, `intents.js`): Naive Bayes multinomial com
   prior uniforme e suavização aditiva 0,1, treinado com 212 frases em 15
   intenções. Palavra fora do vocabulário é trocada pela mais parecida
   (distância de edição 1, ou 2 em palavras longas), o que tolera erros como
   "frte". O classificador devolve a probabilidade e a cobertura (fração das
   palavras que o modelo conhece).
3. **Entidades** (`entities.js`): categoria, tipo de efeito ou acessório,
   gênero (sinônimos da base de conhecimento, do mais longo para o mais curto:
   "blues rock" antes de "blues" e de "rock"), estilo, formato, captação,
   tecnologia, sonoridade, uso, nível, marca, faixa de preço ("até 3 mil",
   "entre 1000 e 2500", "uns 1500"; "10x", "15 W" e "3 m" não contam) e produto
   citado pelo nome (só termos raros do modelo, nunca palavras de gênero ou de
   ficha técnica).
4. **Roteamento** (`index.js`): regras sobre a intenção e as entidades.
   - Uma resposta a uma pergunta do assistente continua o assunto.
   - Dúvida informativa precisa de palavra-chave que a confirme (ex.: frete,
     prazo, pix, cupom) entre as três intenções mais prováveis.
   - Frase com entidade de compra vira recomendação.
   - Confiança abaixo de 0,45 ou cobertura baixa viram "não entendi", com
     exemplos de pergunta. Essas frases ficam marcadas (`entendeu: false`) para
     a camada opcional do Gemini (etapa 25).
5. **Central de Ajuda** (`help-search.js`, etapa 20): busca nas perguntas de
   `src/knowledge/help.js` (a mesma fonte da página `ajuda.html`) por palavras
   em comum, com peso maior para as raras (IDF); a pergunta e os termos valem
   inteiro e o texto da resposta, 30%. Só responde sozinha com pelo menos duas
   palavras da pergunta e metade do peso da frase; entra nas dúvidas de conta
   e antes do "não entendi".
6. **Recomendação** (`recommend.js`): filtros obrigatórios (categoria, preço,
   marca, tipo, formato…), e o gênero limita guitarras, amplificadores e pedais
   aos indicados para ele ou versáteis. A pontuação soma:
   - gênero indicado na ficha: 4;
   - cada característica que a base de conhecimento associa ao gênero: 2 para
     a primeira da lista, 1 para as demais;
   - estilo: 2;
   - nível e uso: 1,5 cada.

   "Mais barato" mostra só itens mais baratos que os já exibidos. O setup
   divide o orçamento por peça e troca a peça mais cara por uma alternativa
   quando estoura; se sobra orçamento, melhora a guitarra e o amplificador.
7. **Ações e página atual** (`actions.js`, etapa 24): antes da classificação
   geral, regras reconhecem glossário, cupom, "adicionar", carrinho,
   comparação, histórico, favoritos e perguntas de ficha. O navegador envia a
   página aberta (tipo e ID do produto), o carrinho (IDs e quantidades) e os
   favoritos (IDs); o servidor confere tudo contra o catálogo. "Essa", "ela" e
   "o produto" apontam para o produto da página; "a primeira" e "a segunda",
   para a última lista mostrada. Produtos citados em partes diferentes da
   frase ("a SG com a Les Paul") são reconhecidos separadamente.
8. **Contexto**: a conversa guarda filtros, a pergunta pendente, as perguntas
   já feitas e os produtos já mostrados. O objeto vai e volta pelo navegador
   (o servidor não guarda estado). Tudo que chega é revalidado
   (`context.js`): só chaves conhecidas, valores das listas do esquema e
   limites de tamanho. Um pedido novo ("procuro um pedal de fuzz") recomeça a
   busca; "e um amplificador?" mantém gênero e estilo.

## Segurança e limites

- `POST /api/assistente`: só para quem está logado. Mensagem de 1 a 500
  caracteres, contexto até 4 KB e 40 mensagens a cada 5 minutos por usuário.
- Pedidos lidos só da partição do próprio cliente.
- Links de resposta só para caminhos internos; o navegador também confere.
- Respostas com produtos reais e preço do servidor; o carrinho continua sendo
  recalculado no checkout.
- O histórico fica no `sessionStorage` da aba e some ao fechar o navegador.
- Frases que o assistente não entende são guardadas sem identificar o cliente
  (e-mails, códigos de pedido e telefones são trocados por marcadores), por até
  90 dias, e aparecem no painel em "Assistente", agrupadas e contadas, para
  virar frases de treino ou perguntas da Central de Ajuda.
- Adicionar ao carrinho, aplicar cupom e pedir troca sempre dependem do clique
  do cliente; produto esgotado não vira botão de compra.

## Avaliação

`npm run agente:eval` roda o pipeline completo sobre 96 frases **que não
estão no treino** (`src/assistant/eval-set.js`), com intenção esperada. Em parte
delas também verifica as entidades. Também roda duas conversas de várias
mensagens. O teste `tests/assistant.test.js` garante que nenhuma frase de
avaliação esteja no treino e que a acurácia fique acima de 90%.

Resultado em 12/11/2026, depois da etapa 24 (assistente que age):

| Medida | Resultado |
| --- | --- |
| Intenção (116 frases fora do treino) | 94,8% |
| Entidades (48 campos) | 100% |
| Conversas de várias mensagens | 3 de 3 |

Na etapa 24 entraram 20 frases de ações (glossário, comparação, ficha, adicionar,
cupom, carrinho, histórico, favoritos e filtros novos), algumas com a página do
produto ou o carrinho informados, e uma conversa na página do produto (ficha,
comparação com o produto aberto e "adiciona a segunda"). As novas foram usadas
para ajustar as regras, então medem a cobertura e não a generalização.

Histórico: etapa 19, 95,5% em 88 frases; etapa 20, 93,8% em 96 (8 frases de
ajuda e conta, duas falhas mantidas para a medida não ser viciada).

Erros restantes:
- "eae" e "boa, até amanhã" ficaram abaixo da confiança mínima.
- Duas perguntas fora do assunto ("quem descobriu o Brasil") caíram em "não
  entendi" em vez de "fora do escopo". Nesses dois casos a resposta ao cliente
  é parecida.

Limitações conhecidas:
- Negações ("não quero vintage") não são tratadas.
- Só um gênero por frase.
- Frases muito longas e com vários pedidos ao mesmo tempo atendem só ao
  principal.

## Gemini e voz (etapa 25)

- Com `GEMINI_API_KEY` no ambiente, as frases que a PLN local não entende
  (`entendeu: false`) vão ao Gemini do plano gratuito, sem e-mail, telefone ou
  código de pedido, junto com o catálogo resumido (ID, produto, categoria,
  preço, estoque e ficha) e as regras da Central de Ajuda. O modelo devolve
  JSON com texto e até 3 IDs; o servidor descarta IDs que não existem ou estão
  esgotados e remove HTML. Erro, tempo limite (6 s), limite por minuto (8) ou
  resposta inválida mantêm a resposta local. A conversa mostra "Resposta
  gerada com o Gemini (Google)".
- Sem a chave, nada muda: tudo continua local e sem custo.
- Conferência com a chave real: `npm run agente:smoke` e
  `npm run agente:eval -- --gemini` (tarefa T07).
- Microfone: Web Speech API do navegador, em português. A fala preenche o
  campo e o cliente confere e envia; o primeiro uso explica que o navegador
  pode usar um serviço de voz externo. Sem suporte (Firefox), o botão não
  aparece.
