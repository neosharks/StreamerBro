# ---- build the React frontend ----
FROM node:22-bookworm-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# ---- install server deps (build tools available for native modules) ----
FROM node:22-bookworm-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ---- runtime: node + ffmpeg + yt-dlp ----
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg python3 ca-certificates curl \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    MEDIA_DIR=/media \
    DATA_DIR=/data \
    THUMBS_DIR=/data/thumbnails

COPY --from=deps /app/node_modules ./node_modules
COPY package.json VERSION ./
COPY server ./server
COPY scripts ./scripts
COPY --from=web /app/web/dist ./web/dist

RUN mkdir -p /media /data/thumbnails
VOLUME ["/media", "/data"]
EXPOSE 8080
CMD ["node", "server/index.js"]
