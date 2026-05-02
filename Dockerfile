# EstatesCRM — production image (Docker Hub only; avoids ghcr.io timeouts).
#
# Coolify: "git ls-remote https://github.com/... Failed to connect to github.com port 443"
#   That happens BEFORE this Dockerfile runs — the build server cannot reach GitHub.
#   Fix on the server/network (allow outbound HTTPS to github.com), OR in Coolify use a
#   Source URL over SSH (git@github.com:ORG/REPO.git) + deploy key if port 22 works, OR
#   build/push the image in GitHub Actions and deploy from a registry Coolify can reach.
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
