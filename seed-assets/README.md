# Fontes das imagens do catálogo

Coloque as **22 imagens PNG fornecidas pelo usuário** em `seed-assets/produtos-violet-voltage/`, com as subpastas `correias`, `amplificadores`, `pedais`, `guitarras`, `acessorios` e `cabos`. Preserve nomes, espaços, acentos e capitalização. O manifesto completo está em `src/services/seed-products.js`; inclusive `correira preta padrão.png` mantém a grafia do arquivo original.

Essa pasta está em `.gitignore` e não deve entrar no repositório público. Os arquivos são **apenas fontes para upload**, nunca são servidos pelo Express. Não altere as imagens para executar o seed. Use somente materiais que você tenha direito de utilizar.

## Executar em memória

Na raiz do projeto, após instalar as dependências:

```powershell
$env:DEV_MEMORY_STORAGE='true'
$env:PORT='3000'
npm run seed
```

O comando lê e confere todas as imagens, carrega 22 produtos e faz 22 chamadas a `storage.upload`, com MIME `image/png`. Em memória, os arquivos ficam no adaptador, e o mesmo processo abre a loja em `http://localhost:3000`. Dados e imagens desaparecem ao parar o servidor. Não execute `npm start` em outro processo esperando compartilhar essa memória.

## Executar no Azure

1. Mantenha as 22 imagens na pasta local indicada.
2. Configure a connection string real em `AZURE_STORAGE_CONNECTION_STRING` e um `JWT_SECRET` privado, usando `.env` local ignorado ou variáveis no terminal. Não imprima nem compartilhe os valores.
3. Se estiver no terminal usado para a demonstração em memória, altere explicitamente a variável, pois ela tem precedência sobre `.env`:

```powershell
$env:DEV_MEMORY_STORAGE='false'
npm run seed
```

4. Confira o resumo de produtos criados/atualizados e **22 imagens enviadas**. Com Azure, o script encerra após concluir.
5. Inicie a aplicação com `npm start`, ou use o serviço já publicado com a mesma conta Storage.

Os recursos continuam sendo `AllanRibeiroProdutos`, `AllanRibeiroClientes`, `AllanRibeiroPedidos` e o contêiner privado `allan-ribeiro-produtos`. Não é preciso tornar os blobs públicos. A aplicação no Render lê as imagens do **Azure Blob Storage** pelo proxy `/api/images/:id`; ela não depende desta pasta, de um disco persistente ou de um upload manual dos PNGs ao repositório. Rode o seed localmente contra o Azure antes de conferir o catálogo publicado.

## Repetição e preservação

- IDs reservados: `demo-001` a `demo-022`.
- O seed atualiza esses produtos mesmo quando sua categoria ou partição mudou, preservando a partição existente e `createdAt` e atualizando `updatedAt`.
- Cada imagem usa um nome determinístico e seguro: `seed/violet-voltage/demo-NNN.png`.
- Repetir não duplica produtos ou nomes de blob. Reaplica os dados e estoques do manifesto para os IDs seed; não use esses IDs para produtos manuais.
- Nenhum produto manual com outro ID ou blob alheio é excluído. O seed não remove blobs, inclusive imagens manuais antigas de um produto seed.
- Se faltar a pasta, qualquer uma das imagens ou se houver arquivo que não seja PNG, a execução para antes de qualquer upload/cadastro. Nomes de arquivo precisam coincidir exatamente, inclusive em Linux.
- Uma falha de conexão durante a gravação pode interromper a carga; não há transação global entre Table e Blob. Corrija a conexão e execute novamente.
- Os SVGs originais de `public/assets` continuam disponíveis como fallback de produtos sem imagem. Os 22 produtos desta carga usam os PNGs enviados ao armazenamento.

Os testes automatizados geram suas próprias imagens temporárias, sem precisar incluir os PNGs privados no repositório.
