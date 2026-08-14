# node:20-bookworm-slim (glibc) rather than alpine (musl) — Prisma's query
# engine binaries are prone to musl/glibc mismatches, and using the same base
# for every stage sidesteps that entirely.

# ---- deps: full install, used only to build ------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app -------------------------------------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` statically pre-renders pages that query Prisma at build time
# (e.g. the dashboard) — against a schema-less database those queries throw,
# so this needs real (if empty) tables to build against, not just a URL that
# parses. A placeholder path is still fine; only the schema has to be real.
ENV DATABASE_URL="file:./build-placeholder.db"
RUN npx prisma generate
RUN npx prisma db push --skip-generate --accept-data-loss
RUN npx next build

# ---- prod-deps: lean runtime-only node_modules -----------------------------
# A separate install (not just `npm prune`) so devDependencies like electron,
# electron-builder, and typescript never end up in the runtime image. `prisma`
# is a real dependency (not dev) specifically so it lands here — the CLI is
# needed at container start by scripts/docker-init-db.js.
FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
ENV DATABASE_URL="file:./build-placeholder.db"
RUN npx prisma generate

# ---- runner: final runtime image ------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# 0.0.0.0, not Electron's 127.0.0.1 — Caddy is a separate container and needs
# to reach this one over the compose network.
ENV HOSTNAME=0.0.0.0
ENV PORT=3456

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
# Next's standalone output carries its own (smaller, tracing-based) copy of
# node_modules; merging it on top of the lean install above is a safe no-op
# (same versions, same generated Prisma client) and this is the same layout
# electron-builder.yml already bundles for the desktop app.
COPY --from=builder /app/.next/standalone/ ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/scripts/docker-init-db.js ./scripts/docker-init-db.js

EXPOSE 3456

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3456)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/docker-init-db.js && node server.js"]
