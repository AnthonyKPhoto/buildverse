FROM node:20-alpine AS deps
WORKDIR /app
# openssl is required by Prisma's query engine on Alpine
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy URL so Next.js doesn't error if any module-level Prisma import is evaluated
ENV DATABASE_URL=file:/tmp/build.db
ENV NEXT_TELEMETRY_DISABLED=1
# Avoid OOM on constrained CI runners
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN node_modules/.bin/prisma generate && node_modules/.bin/next build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/buildverse.db
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S buildverse && adduser -S buildverse -G buildverse

COPY --from=builder --chown=buildverse:buildverse /app/.next/standalone ./
COPY --from=builder --chown=buildverse:buildverse /app/.next/static ./.next/static
COPY --from=builder --chown=buildverse:buildverse /app/public ./public
COPY --from=builder --chown=buildverse:buildverse /app/prisma ./prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=buildverse:buildverse /app/node_modules/prisma ./node_modules/prisma

RUN mkdir -p /data && chown buildverse:buildverse /data

USER buildverse
EXPOSE 3000

CMD ["sh", "-c", "node node_modules/prisma/build/index.js db push --skip-generate && node server.js"]
