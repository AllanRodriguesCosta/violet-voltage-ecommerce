# Assistente de compras (Fase 3, etapa 19)

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
| Conversa | saudação, ajuda, agradecimento, despedida, assunto fora da loja | Respostas curtas, com sugestões de próxima pergunta |

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
     a camada opcional do Gemini (etapa 20).
5. **Recomendação** (`recommend.js`): filtros obrigatórios (categoria, preço,
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
6. **Contexto**: a conversa guarda filtros, a pergunta pendente, as perguntas
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

## Avaliação

`npm run agente:eval` roda o pipeline completo sobre 88 frases **que não
estão no treino** (`src/assistant/eval-set.js`), com intenção esperada. Em parte
delas também verifica as entidades. Também roda duas conversas de várias
mensagens. O teste `tests/assistant.test.js` garante que nenhuma frase de
avaliação esteja no treino e que a acurácia fique acima de 90%.

Resultado em 12/11/2026:

| Medida | Resultado |
| --- | --- |
| Intenção (88 frases fora do treino) | 95,5% |
| Entidades (46 campos) | 100% |
| Conversas de várias mensagens | 2 de 2 |

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

A etapa 20 acrescenta o Gemini gratuito só para as frases que a PLN local não
entender, mantendo as respostas presas aos dados da loja.
