FROM node:24-alpine AS builder
WORKDIR /app
# pnpm version comes from the packageManager field in package.json.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build && pnpm prune --prod

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 BODY_SIZE_LIMIT=12M
COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
# /login is the one page that answers 200 without a session.
HEALTHCHECK --interval=1m --timeout=10s --start-period=15s --retries=3 \
	CMD wget --spider -q http://127.0.0.1:3000/login || exit 1
CMD ["node", "build"]
