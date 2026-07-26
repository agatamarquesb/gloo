FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/web/package.json packages/web/package.json

RUN pnpm install --filter @gloo/shared --filter @gloo/web

COPY packages/shared packages/shared
COPY packages/web packages/web

WORKDIR /app/packages/web

EXPOSE 5173

# Re-run install at container start (not just build time): packages/web is
# bind-mounted, so a dependency added on the host would otherwise be missing
# from the container's node_modules volume until the image was rebuilt.
CMD ["sh", "-c", "pnpm install --filter @gloo/shared --filter @gloo/web && pnpm dev -- --host"]
