# Etapa 31: imagem única para Azure (VMs atrás do Load Balancer, Container Apps) ou qualquer Docker.
# Configuração só por variáveis de ambiente (veja .env.example); nada de segredo dentro da imagem.
# Etapa 39: primeiro estágio gera o frontend React (Vite); a imagem final leva só dist/.
FROM node:24-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
COPY --from=web /app/dist ./dist
USER node
EXPOSE 3000
# O balanceador usa /api/health; o Docker também, para reiniciar um contêiner travado.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
