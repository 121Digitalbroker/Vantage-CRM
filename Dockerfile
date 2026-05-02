# EstatesCRM — production image (Docker Hub only; avoids Nixpacks/ghcr.io timeouts on Coolify).
# Coolify: set build type to Dockerfile if it still picks Nixpacks.
#
# Build: docker build -t estatescrm .
# Run:   docker run -p 3000:3000 -e PORT=3000 --env-file .env estatescrm

FROM docker.io/library/node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM docker.io/library/node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server ./server

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server/index.js"]
