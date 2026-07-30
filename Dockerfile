FROM node:20-slim AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL=file:/tmp/build.db
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN node_modules/.bin/prisma generate
RUN node_modules/.bin/next build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/buildverse.db
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y openssl --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN groupadd -r buildverse && useradd -r -g buildverse buildverse

COPY --from=builder --chown=buildverse:buildverse /app/.next/standalone ./
COPY --from=builder --chown=buildverse:buildverse /app/.next/static ./.next/static
COPY --from=builder --chown=buildverse:buildverse /app/public ./public
COPY --from=builder --chown=buildverse:buildverse /app/prisma ./prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=buildverse:buildverse /app/scripts/docker-init-db.js ./scripts/docker-init-db.js

RUN mkdir -p /data && chown buildverse:buildverse /data

USER buildverse
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node scripts/docker-init-db.js && node server.js"]
