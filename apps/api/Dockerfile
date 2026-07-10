FROM node:22-alpine

RUN npm install -g pnpm@11.9.0
WORKDIR /app

# Manifests first for layer caching (all workspace manifests are required
# for a frozen-lockfile install, even for packages we don't install).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @tracklore/api...

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @tracklore/shared build \
  && DISABLE_ERD=true pnpm --filter @tracklore/api exec prisma generate \
  && pnpm --filter @tracklore/api build

WORKDIR /app/apps/api
EXPOSE 3000

# Migrations run at boot so a self-host upgrade is just "pull + up".
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
