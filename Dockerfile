# EstatesCRM — production image (Docker Hub only; avoids ghcr.io timeouts).
#
# If Coolify shows: FROM ghcr.io/railwayapp/nixpacks:... → you are on Nixpacks, not this file.
# Fix in Coolify (see https://coolify.io/docs/applications/build-packs/dockerfile ):
#   1. Resource → Configuration → Build
#   2. Build Pack: change "Nixpacks" → "Dockerfile"
#   3. Base Directory: / (or your app subfolder)
#   4. Dockerfile: Dockerfile (this file at repo root)
#   5. Save → Redeploy
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
