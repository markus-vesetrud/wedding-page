FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
COPY shared ../shared
RUN npm run build

FROM node:22-alpine AS server-build
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci

COPY server/ ./
COPY shared ../shared
RUN npm run build

FROM node:22-alpine AS server-deps
WORKDIR /app/server

COPY server/package.json server/package-lock.json* ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app

# Overridden by compose for specific environments
ENV NODE_ENV=production
ENV PORT=3000
ENV STATE_FILE=/data/state.json

COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY --from=server-build /app/server/dist ./
COPY --from=frontend-build /app/frontend/build ./server/public

RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "server/src/server.js"]