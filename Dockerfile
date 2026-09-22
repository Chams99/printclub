FROM oven/bun:1.3.14-debian AS base

WORKDIR /app
ENV CI=true

COPY package.json bun.lock bunfig.toml turbo.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json

# The root postinstall runs Varlock code generation. Keep schemas in the
# dependency layer, but never copy ignored .env files or deployment secrets.
COPY apps/web/.env.schema apps/web/.env.schema
COPY apps/server/.env.schema apps/server/.env.schema
COPY packages/db/.env.schema packages/db/.env.schema
RUN mkdir -p apps/web/src apps/server/src packages/db/src

RUN bun install --frozen-lockfile

FROM base AS migrate
COPY . .

FROM migrate AS builder
ARG NODE_ENV=production
ARG VITE_SERVER_URL
ARG VITE_GOOGLE_CLIENT_ID=
ENV NODE_ENV=${NODE_ENV}
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
ENV VITE_GOOGLE_CLIENT_ID=${VITE_GOOGLE_CLIENT_ID}
RUN bun run build

FROM oven/bun:1.3.14-debian AS web
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/apps/web/start.mjs ./apps/web/start.mjs
EXPOSE 3001
CMD ["bun", "apps/web/start.mjs"]

FROM oven/bun:1.3.14-debian AS api
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
EXPOSE 3000
CMD ["bun", "apps/server/dist/index.mjs"]
