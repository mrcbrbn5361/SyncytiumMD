# Stage 1: Build from TypeScript sources
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json tsconfig.json tsup.config.ts ./
RUN npm ci

COPY src ./src
RUN npm run build

# Stage 2: Production runtime
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

ENTRYPOINT ["node", "dist/mcp/index.js"]

