# Stage 1: Build client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# Stage 2: Build server
FROM node:20-alpine AS server-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npx tsc

# Stage 3: Production image
FROM node:20-alpine
WORKDIR /app

# Install ripgrep for search_code tool
RUN apk add --no-cache ripgrep

# Copy server
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/package.json ./server/package.json

# Copy client build into location Express serves it from
COPY --from=client-builder /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
