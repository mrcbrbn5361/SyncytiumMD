FROM node:20-alpine AS builder
WORKDIR /app

# Dependencies first so the layer caches across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build


FROM node:20-alpine AS runtime
WORKDIR /app

# `.syncytium/` is intentionally NOT copied: mount your workspace at /workspace
# and point the server at it (see CMD below).
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# The MCP server speaks stdio, so the container needs a long-lived stdin pipe:
#   docker run -i --rm -v "$PWD:/workspace:ro" syncytium graph
# To serve the visual knowledge graph instead, override the command:
#   docker run -p 3737:3737 -v "$PWD:/workspace" syncytium graph --port 3737 --no-open

# Runs as a non-root user; /workspace is the mounted context.
RUN addgroup -S syncytium && adduser -S -G syncytium syncytium
USER syncytium

CMD ["node", "dist/mcp/index.js"]
