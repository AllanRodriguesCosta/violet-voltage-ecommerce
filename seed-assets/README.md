# Fontes das imagens do catálogo

Coloque as **80 imagens PNG fornecidas pelo usuário** em `seed-assets/produtos-violet-voltage/`, com as subpastas `correias`, `amplificadores`, `pedais`, `guitarras`, `acessorios` e `cabos`: as 22 originais e as 58 novas (53 da etapa 18, 2 da etapa 21 e 3 da etapa 22), listadas com nome de arquivo em [`docs/FOTOS-PENDENTES.txt`](../docs/FOTOS-PENDENTES.txt). Preserve nomes, espaços, acentos e capitalização. O manifesto completo está em `src/services/seed-products.js`; inclusive `correira preta padrão.png` mantém a grafia do arquivo original.

Para conferir a pasta sem alterar nada: `npm run fotos:conferir` (fotos prontas, faltando, PNGs inválidos e arquivos acima de 1 MB).

Essa pasta está em `.gitignore` e não deve entrar no repositório público. Os arquivos são **apenas fontes para upload**, nunca são servidos pelo Express. Não altere as imagens para executar o seed. Use somente materiais que você tenha direito de utilizar.

## Executar em memória

Na raiz do projeto, após instalar as dependências:

```powershell
$env:DEV_MEMORY_STORAGE='true'
$env:PORT='3000'
npm run seed
```

O comando lê e confere todas as imagens, carrega os 80 produtos e faz uma chamada a `storage.upload` por imagem, com MIME `image/png`. Em memória, os arquivos ficam no adaptador, e o mesmo processo abre a loja em `http://localhost:3000`. Dados e imagens desaparecem ao parar o servidor. Não execute `npm start` em outro processo esperando compartilhar essa memória.

## Executar no PostgreSQL

1. Mantenha as imagens na pasta local indicada (`npm run fotos:conferir` mostra o que falta).
2. Configure a URI real em `DATABASE_URL`, `DATABASE_SSL=true` e um `JWT_SECRET` privado, usando `.env` local ignorado ou variáveis no terminal. Não imprima nem compartilhe os valores.
3. Se estiver no terminal usado para a demonstração em memória, altere explicitamente a variável, pois ela tem precedência sobre `.env`:

```powershell
$env:DEV_MEMORY_STORAGE='false'
npm run seed
```

4. Confira o resumo de produtos criados/atualizados e **75 imagens enviadas**. Com PostgreSQL, o script encerra após concluir.

### Carga parcial

Enquanto nem todas as fotos novas estiverem prontas, `npm run seed -- --parcial` carrega só os produtos que já têm foto e lista os que ficaram de fora. Rodar de novo quando chegarem mais fotos completa o catálogo sem duplicar. Sem `--parcial`, uma única foto faltando interrompe tudo antes de qualquer gravação (e a mensagem lista todas as que faltam).
5. Inicie a aplicação com `npm start`, ou use o serviço já publicado com o mesmo banco PostgreSQL.

Os dados ficam no schema privado `violet_voltage`; imagens são bytes na tabela `images`. A aplicação no Render lê as imagens do PostgreSQL pelo proxy `/api/images/:id`. Não precisa de Supabase Storage, Azure, disco persistente ou dos PNGs no repositório. Rode o seed localmente contra o mesmo banco usado pelo Render antes de conferir o catálogo publicado.

## Repetição e preservação

- IDs reservados: `demo-001` a `demo-075` (`demo-023` em diante são da etapa 18). Novos produtos do manifesto entram sempre no fim.
- O seed atualiza esses produtos mesmo quando sua categoria ou partição mudou, preservando a partição existente e `createdAt` e atualizando `updatedAt`.
- Cada imagem usa um nome determinístico e seguro: `seed/violet-voltage/demo-NNN.png`.
- Repetir não duplica produtos ou nomes de blob. Reaplica os dados e estoques do manifesto para os IDs seed; não use esses IDs para produtos manuais.
- Nenhum produto manual com outro ID ou blob alheio é excluído. O seed não remove blobs, inclusive imagens manuais antigas de um produto seed.
- Se faltar a pasta, qualquer uma das imagens (fora do modo `--parcial`) ou se houver arquivo que não seja PNG, a execução para antes de qualquer upload/cadastro. Nomes de arquivo precisam coincidir exatamente, inclusive em Linux.
- Uma falha de conexão durante a gravação pode interromper a carga; o seed não envolve toda a carga em uma transação única. Corrija a conexão e execute novamente.
- Os SVGs originais de `public/assets` continuam disponíveis como fallback de produtos sem imagem. Os produtos desta carga usam os PNGs enviados ao armazenamento.

Os testes automatizados geram suas próprias imagens temporárias, sem precisar incluir os PNGs privados no repositório.

