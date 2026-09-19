FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY dist ./dist

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/mcp/index.js"]
