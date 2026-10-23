# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d
ARG WEB_BASE_PATH=/penshow/

FROM ${NODE_IMAGE} AS build
WORKDIR /workspace
RUN npm install --global pnpm@12.9.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY e2e/package.json e2e/package.json
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY apps apps
COPY scripts scripts
COPY data data
COPY licenses licenses
COPY THIRD_PARTY_NOTICES.md ./
ARG WEB_BASE_PATH
ENV VITE_BASE_PATH=${WEB_BASE_PATH}
RUN pnpm questions:check && pnpm avatars:check && pnpm build
RUN pnpm --filter @penshow/server deploy --prod /out/apps/server

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ARG WEB_BASE_PATH
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_ROOT=/app/apps/web/dist \
    WEB_BASE_PATH=${WEB_BASE_PATH}
COPY --from=build --chown=node:node /out/apps/server ./apps/server
COPY --from=build --chown=node:node /workspace/apps/web/dist ./apps/web/dist
COPY --from=build --chown=node:node /workspace/data/questions/published/catalog.json ./data/questions/published/catalog.json
COPY --from=build --chown=node:node /workspace/data/narration/generated ./data/narration/generated
COPY --from=build --chown=node:node /workspace/data/licenses ./data/licenses
COPY --from=build --chown=node:node /workspace/data/sources.json ./data/sources.json
COPY --from=build --chown=node:node /workspace/licenses ./licenses
COPY --from=build --chown=node:node /workspace/THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node infra/healthcheck.mjs ./infra/healthcheck.mjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=15s --retries=3 CMD ["node", "infra/healthcheck.mjs"]
CMD ["node", "apps/server/dist/main.js"]
