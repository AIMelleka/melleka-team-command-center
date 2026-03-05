# Stage 1: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx tsc && cp -r src/data dist/data 2>/dev/null || true

# Stage 2: Production image
FROM node:20-alpine
WORKDIR /app

# Install ripgrep for search_code tool and vercel CLI for deploy_site tool
RUN apk add --no-cache ripgrep
RUN npm install -g vercel

# Copy server
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/package.json

WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
