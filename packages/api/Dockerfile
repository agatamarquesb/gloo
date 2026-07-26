FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api/package.json packages/api/package.json

RUN pnpm install --filter @gloo/shared --filter @gloo/api

COPY packages/shared packages/shared
COPY packages/api packages/api

WORKDIR /app/packages/api

EXPOSE 3001

# Both steps run at container start rather than build time, because packages/api
# is bind-mounted: generated Prisma output would be masked by the mount, and
# dependencies added on the host would be missing from the node_modules volume.
CMD ["sh", "-c", "pnpm install --filter @gloo/shared --filter @gloo/api && pnpm prisma:generate && pnpm dev"]
