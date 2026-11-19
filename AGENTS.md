# Convenções
- JavaScript ES modules e Express no backend. Frontend em React 19 + TypeScript (Vite) em web/ (ver docs/FRONTEND-REACT.md); regras usadas pelo servidor e pela loja ficam em shared/ (JavaScript puro, sem DOM). public/ só guarda arquivos estáticos.
- Não executar operações Git; o usuário gerencia o repositório.
- Nunca registrar segredos, senhas ou tokens.
- Valores monetários em centavos inteiros; checkout sempre recalculado no servidor.
- Produção usa PostgreSQL no schema privado violet_voltage; memória é apenas para desenvolvimento. Migração autorizada pelo usuário em novembro de 2026.
- Executar npm run lint e npm test após alterações de regras de negócio; no frontend, também npm run typecheck e npm run build.
- Para continuidade do roadmap, ler ROADMAP_LOCAL.txt quando disponível e atualizar seu estado após cada entrega. Esse arquivo é local e ignorado; docs/ROADMAP.md mantém apenas o resumo público. Instruções atuais do usuário prevalecem.
- Registrar ideias fora do escopo atual na seção Roadmap 2 do arquivo local, como sugestões para depois do Roadmap 1; não implementá-las nem atrasar o escopo atual por elas.
